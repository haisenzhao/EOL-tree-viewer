var pivotTreemap = {
	doLayout: function doLayout(parent, nodeOps) { 
		var layoutBounds = nodeOps.getLayoutBounds(parent),
			children = nodeOps.getLayoutChildren(parent),
			layoutArea = layoutBounds.width * layoutBounds.height,
			totalChildArea = children.reduce(function (accumulate, value) {return accumulate + nodeOps.getDisplayArea(value); }, 0),
			scale = layoutArea / totalChildArea,
			scaledNodeOps = squarifiedTreemap.shallowCopy(nodeOps),
			child;
		
		/* 
		 * Replace nodeOps with one that re-scales the child areas to fill this parent's layout area 
		 * (This will be used in layoutNodes, but not passed on to the recursive call to doLayout)
		 */
		scaledNodeOps.getDisplayArea = function scaledAreaCalc(node) {
			return scale * nodeOps.getDisplayArea(node);
		};
		
		if (children && layoutArea > 0) {
			this.layoutNodes(children, layoutBounds, scaledNodeOps, this.makePivotBySize(nodeOps.getDisplayArea));

			for (child = 0; child < children.length; child++) {
				this.doLayout(children[child], nodeOps);
			}
		}
	},
	
	layoutNodes: function layoutNodes(nodes, layoutBounds, nodeOps, pivotFunction) {
		var width = Math.min(layoutBounds.width, layoutBounds.height),
			pivotIndex = pivotFunction(nodes, nodeOps.getDisplayArea),
			pivotArea = nodeOps.getDisplayArea(nodes[pivotIndex]),
			partition = this.partition(nodes, pivotIndex, nodeOps.getDisplayArea, width),
			areas = this.getAreas(partition, nodeOps.getDisplayArea),
			regions = this.getRegions(partition, areas, pivotArea, layoutBounds),
			list;
		
		//setBounds on pivot
		nodeOps.setBounds(nodes[pivotIndex], regions.pivotBounds);
		
		//recursively lay out lists in their regions
		for (list = 0; list < partition.length; list++) {
			if (partition[list].length > 0) {
				this.layoutNodes(partition[list], regions.otherRegions[list], nodeOps, pivotFunction);
			}
			
			/* TODO just doing a squarifiedTreemap.layoutRow gets a little
			 * better aspect ratios if there are few nodes in the partition.
			 * Extend this to do that. 
			 * 
			 * Update: this is actually already covered in the Stopping Conditions 
			 * section of http://hcil.cs.umd.edu/trs/2001-18/2001-18.html
			 */
			//if (partition[list].length > 3) {
			//	this.layoutNodes(partition[list], regions.otherRegions[list], nodeOps, pivotFunction);
			//} else if (partition[list].length > 0) {
			//	var bounds = regions.otherRegions[list],
			//		dir = bounds.width > bounds.height ? "h" : "v";
			//	squarifiedTreemap.layoutNodes(partition[list], regions.otherRegions[list], dir, nodeOps);
			//}
		}
	},
	
	//return an array like [list1, list2, list3].
	partition: function partition(nodes, pivotIndex, areaCalc, layoutWidth) {
		var part = [[], [], []],
			list2End;
		
		list2End = this.bestList2End(nodes, pivotIndex, areaCalc, layoutWidth);
		
		part[0] = nodes.slice(0, pivotIndex); //this slice doesn't include nodes[pivotIndex] 
		part[1] = nodes.slice(pivotIndex + 1, list2End); //this slice doesn't include nodes[list2End] 
		part[2] = nodes.slice(list2End); //this slice *does* include nodes[list2End].  empty list if list2End == nodes.length
		
		return part;
	},
	
	pivotAspectRatio: function pivotAspectRatio(pivotArea, list2Area, layoutWidth) {
		var pivotHeight = layoutWidth / (list2Area / pivotArea + 1),
			pivotWidth =  pivotArea / pivotHeight;
		
		return Math.max(pivotWidth / pivotHeight, pivotHeight / pivotWidth);
	},
	
	bestList2End: function bestList2End(nodes, pivotIndex, areaCalc, layoutWidth) {
		/* 
		 * Let  L2 and  L3 be such that all items in  L2
		 * have an index less than those in  L3, and the aspect 
		 * ratio of  P is as close to 1 as possible.  
		 */
		var pivotArea = areaCalc(nodes[pivotIndex]),
			pivotRatio,
			list2Start = pivotIndex + 1,
			list2End,
			list2Area = areaCalc(nodes[list2Start]);
		
		for (list2End = list2Start + 1; list2End < nodes.length; list2End++) {
			pivotRatio = this.pivotAspectRatio(pivotArea, list2Area, layoutWidth);
			
			list2Area += areaCalc(nodes[list2End]);
			
			if (pivotRatio < this.pivotAspectRatio(pivotArea, list2Area, layoutWidth)) { //TODO factor out the second call to pivotAspectRatio. should only need to call once per iter
				break;
			}
		}
		
		//to avoid degenerate layouts,  L3 cannot contain exactly one item.
		if (list2End === nodes.length - 1) {
			list2End = nodes.length;
		}
		
		return list2End;
	},
	
	//return an array [AreaList1, AreaList2, AreaList3]
	getAreas: function getAreas(partition, areaCalc) {
		return [
		        partition[0].reduce(function (accumulate, value) {return accumulate + areaCalc(value); }, 0),
		        partition[1].reduce(function (accumulate, value) {return accumulate + areaCalc(value); }, 0),
		        partition[2].reduce(function (accumulate, value) {return accumulate + areaCalc(value); }, 0)
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
	makePivotBySize: function makePivotBySize(areaCalc) {
		return function pivotBySize(nodes) {
			var area = areaCalc(nodes[0]),
				max = area;
				maxIndex = 0,
				i = 1
			
			for (; i < nodes.length; i++) {
				area = areaCalc(nodes[i]);
				
				if (area > max) {
					max = area;
					maxIndex = i;
				}
			}
				
			return maxIndex;
		};
	},
	
	//return the index of the middle element
	pivotByMiddle: function pivotByMiddle(nodes) {
		return Math.floor((nodes.length - 1) / 2);
	},
	
	//return the index of the element that splits the total area most equally.  (need to verify this is the right goal)
	pivotBySplitSize: function pivotBySplitSize(nodes, areaCalc) {
		//TODO
		
	}
};