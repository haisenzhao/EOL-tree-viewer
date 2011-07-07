var pivotTreemap = {
	doLayout: function doLayout(parent, nodeOps, recursive) {
		var layoutBounds = nodeOps.getLayoutBounds(parent),
		children = nodeOps.getLayoutChildren(parent),
		layoutArea = layoutBounds.width * layoutBounds.height,
		totalChildArea = children.reduce(function (total, child) {return total + nodeOps.getDisplayArea(child); }, 0),
		scale = layoutArea / totalChildArea,
		child;
		
		if (children && children.length > 0 && layoutArea > 0) {
			for (child = 0; child < children.length; child++) {
				children[child].displayArea = scale * nodeOps.getDisplayArea(children[child]);
			}

			this.layoutNodes(children, layoutBounds, nodeOps, this.pivotBySize);

			if (recursive) {
				for (child = 0; child < children.length; child++) {
					this.doLayout(children[child], nodeOps, recursive);
				}
			}
		}
	},
	
	layoutNodes: function layoutNodes(nodes, layoutBounds, nodeOps, pivotFunction) {
		var width = Math.min(layoutBounds.width, layoutBounds.height),
			pivotIndex = pivotFunction(nodes),
			pivotArea = nodes[pivotIndex].displayArea,
			partition = this.partition(nodes, pivotIndex, width),
			areas = this.getAreas(partition, nodeOps.getDisplayArea),
			regions = this.getRegions(partition, areas, pivotArea, layoutBounds),
			list;
		
		//setBounds on pivot
		nodeOps.setBounds(nodes[pivotIndex], regions.pivotBounds);
		
		//recursively lay out lists in their regions
		for (list = 0; list < partition.length; list++) {
			/* just doing a squarifiedTreemap.layoutRow gets a little
			 * better aspect ratios if there are few nodes in the partition. 
			 * 
			 * TODO: this is actually already covered in the Stopping Conditions 
			 * section of http://hcil.cs.umd.edu/trs/2001-18/2001-18.html and there are
			 * three options for handling small partitions.  Implement all three and 
			 * choose the one that gives the best aspect ratios for a each partition.
			 */
			if (partition[list].length > 3) {
				this.layoutNodes(partition[list], regions.otherRegions[list], nodeOps, pivotFunction);
			} else if (partition[list].length > 0) {
				var bounds = regions.otherRegions[list],
					dir = bounds.width > bounds.height ? "h" : "v";
				squarifiedTreemap.layoutNodes(partition[list], regions.otherRegions[list], dir, nodeOps);
			}
		}
	},
	
	//return an array like [list1, list2, list3].
	partition: function partition(nodes, pivotIndex, layoutWidth) {
		var part = [[], [], []],
			list2End;
		
		list2End = this.bestList2End(nodes, pivotIndex, layoutWidth);
		
		part[0] = nodes.slice(0, pivotIndex); //this slice doesn't include nodes[pivotIndex] 
		part[1] = nodes.slice(pivotIndex + 1, list2End); //this slice doesn't include nodes[list2End] 
		part[2] = nodes.slice(list2End); //this slice *does* include nodes[list2End].  empty list if list2End >= nodes.length
		
		return part;
	},
	
	pivotAspectRatio: function pivotAspectRatio(pivotArea, list2Area, layoutWidth) {
		var pivotHeight = layoutWidth / (list2Area / pivotArea + 1),
			pivotWidth =  pivotArea / pivotHeight;
		
		return Math.max(pivotWidth / pivotHeight, pivotHeight / pivotWidth);
	},
	
	bestList2End: function bestList2End(nodes, pivotIndex, layoutWidth) {
		/* 
		 * Let  L2 and  L3 be such that all items in  L2
		 * have an index less than those in  L3, and the aspect 
		 * ratio of  P is as close to 1 as possible.  
		 */
		var pivotArea = nodes[pivotIndex].displayArea,
			pivotRatio,
			list2Start = pivotIndex + 1,
			list2End = list2Start + 1,
			list2Area;
		
		if (list2Start < nodes.length) {
			list2Area = nodes[list2Start].displayArea
			for (; list2End < nodes.length; list2End++) {
				pivotRatio = this.pivotAspectRatio(pivotArea, list2Area, layoutWidth);
				
				list2Area += nodes[list2End].displayArea;
				
				if (pivotRatio < this.pivotAspectRatio(pivotArea, list2Area, layoutWidth)) { //TODO factor out the second call to pivotAspectRatio. should only need to call once per iter
					break;
				}
			}
		}
		
		//to avoid degenerate layouts,  L3 cannot contain exactly one item.
		if (list2End === nodes.length - 1) {
			list2End = nodes.length;
		}
		
		return list2End;
	},
	
	//return an array [AreaList1, AreaList2, AreaList3]
	getAreas: function getAreas(partition) {
		return [
		        partition[0].reduce(function (total, node) {return total + node.displayArea; }, 0),
		        partition[1].reduce(function (total, node) {return total + node.displayArea; }, 0),
		        partition[2].reduce(function (total, node) {return total + node.displayArea; }, 0)
		        ];
	},
	
	//return an object like {pivotBounds, otherRegions[R1, R2, R3]}
	getRegions: function getRegions(partition, areas, pivotArea, layoutBounds) {
		var pivotWidth, pivotHeight;
		
		if (layoutBounds.width > layoutBounds.height) {
			pivotHeight = layoutBounds.height / (areas[1] / pivotArea + 1);
			pivotWidth =  pivotArea / pivotHeight;
			return this.getRegionsHorizontal(partition, areas, pivotWidth, pivotHeight, layoutBounds);
		} else {
			pivotWidth = layoutBounds.width / (areas[1] / pivotArea + 1);
			pivotHeight =  pivotArea / pivotWidth;
			return this.getRegionsVertical(partition, areas, pivotWidth, pivotHeight, layoutBounds);
		}
	},
	
	//For regions wider than they are tall. return an object like {pivotBounds, otherRegions[R1, R2, R3]}
	getRegionsHorizontal: function getRegionsHorizontal(partition, areas, pivotWidth, pivotHeight, layoutBounds) {
		var r1, r2, r3, rp;
		
		r1 = {
				x: layoutBounds.x,
				y: layoutBounds.y,
				height: layoutBounds.height,
				width: areas[0] / layoutBounds.height
			};
		
		rp = {
				x: r1.x + r1.width,
				y: layoutBounds.y,
				width: pivotWidth,
				height: pivotHeight
			};
		
		r2 = {
				x: rp.x,
				y: rp.y + rp.height,
				width: rp.width,
				height: layoutBounds.height - rp.height
			};
		
		r3 = {
				x: rp.x + rp.width,
				y: layoutBounds.y,
				height: layoutBounds.height,
				width: areas[2] / layoutBounds.height
			};
		
		return {pivotBounds: rp, otherRegions: [r1, r2, r3]};
	},
	
	//For regions taller than they are wide. return an object like {pivotBounds, otherRegions[R1, R2, R3]}
	getRegionsVertical: function getRegionsVertical(partition, areas, pivotWidth, pivotHeight, layoutBounds) {
		var r1, r2, r3, rp;

		r1 = {
				x: layoutBounds.x,
				y: layoutBounds.y,
				width: layoutBounds.width,
				height: areas[0] / layoutBounds.width
			};
		
		rp = {
				x: layoutBounds.x,
				y: r1.y + r1.height,
				width: pivotWidth,
				height: pivotHeight
			};
		
		r2 = {
				x: rp.x + rp.width,
				y: rp.y,
				width: layoutBounds.width - rp.width,
				height: rp.height
			};

		r3 = {
				x: layoutBounds.x,
				y: rp.y + rp.height,
				width: layoutBounds.width,
				height: areas[2] / layoutBounds.width
			};
		
		return {pivotBounds: rp, otherRegions: [r1, r2, r3]};
	},
	
	//return the index of the largest element
	pivotBySize: function(nodes) {
		var maxIndex = 0,
			i = 1
		
		for (; i < nodes.length; i++) {
			if (nodes[i].displayArea > nodes[maxIndex].displayArea) {
				maxIndex = i;
			}
		}
			
		return maxIndex;
	},
	
	//return the index of the middle element
	pivotByMiddle: function pivotByMiddle(nodes) {
		return Math.floor((nodes.length - 1) / 2);
	},
	
	//return the index of the element that splits the total area most equally.  (need to verify this is the right goal)
	pivotBySplitSize: function pivotBySplitSize(nodes) {
		//TODO
		
	}
};