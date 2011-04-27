var squarifiedTreemap = {

	doLayout: function doLayout(parent, nodeOps, recursive) {
		var layoutBounds = nodeOps.getLayoutBounds(parent),
			children = nodeOps.getChildren(parent),
			layoutArea = layoutBounds.width * layoutBounds.height,
			totalChildArea = children.reduce(function (accumulate, value) {return accumulate + nodeOps.getDisplayArea(value); }, 0),
			scale = layoutArea / totalChildArea,
			scaledNodeOps,
			child;

		if (children && layoutArea > 0) {
			scaledNodeOps = this.shallowCopy(nodeOps);
			
			/* 
			 * Replace nodeOps with one that re-scales the child areas to fill this parent's layout area 
			 * (This will be used in squarify, but not passed on to the recursive call to doLayout)
			 */
			scaledNodeOps.getDisplayArea = function scaledAreaCalc(node) {
				return scale * nodeOps.getDisplayArea(node);
			};
			
			children.sort(function (a, b) { return nodeOps.getDisplayArea(b) - nodeOps.getDisplayArea(a); }); //sort by area, descending
			this.squarify(children, [], layoutBounds, scaledNodeOps);

			if (recursive) {
				for (child = 0; child < children.length; child++) {
					this.doLayout(children[child], nodeOps, recursive);
				}
			}
		}
	},	

	squarify: function squarify(children, row, bounds, nodeOps) {
		var c = children[0],
			w = Math.min(bounds.width, bounds.height),
			newBounds;

		if (children.length === 0) {
			if (row.length !== 0) {
				this.layoutRow(row, bounds, nodeOps);
			}
			return;	
		}

		if (this.worst(row, w, nodeOps.getDisplayArea) >= this.worst(row.concat([c]), w, nodeOps.getDisplayArea)) {
			this.squarify(children.slice(1), row.concat([c]), bounds, nodeOps);
		} else {
			newBounds = this.layoutRow(row, bounds, nodeOps);
			this.squarify(children, [], newBounds, nodeOps);
		}
	},

	worst: function worst(row, w, areaCalc) {
		if (row.length === 0) { 
			return Number.MAX_VALUE; 
		}

		var r = {
			min: Number.MAX_VALUE,
			max: -Number.MAX_VALUE,
			sum: 0
		};

		r = row.reduce(this.minMaxSum(areaCalc), r);

		return Math.max(w * w * r.max / (r.sum * r.sum), r.sum * r.sum / (w * w * r.min));
	},
	
	layoutRow: function layoutRow(row, bounds, nodeOps) {
		var rowBounds = {
				x: bounds.x,
				y: bounds.y,
				width: 0,
				height: 0
			},
			rowSum = row.reduce(function (accumulate, value) {return accumulate + nodeOps.getDisplayArea(value); }, 0),
			dir;

		if (bounds.width > bounds.height) {
			rowBounds.height = bounds.height;
			rowBounds.width = rowSum / rowBounds.height;
			bounds.x += rowBounds.width;
			bounds.width -= rowBounds.width;
			dir = "v";
		} else {
			rowBounds.width = bounds.width;
			rowBounds.height = rowSum / rowBounds.width;
			bounds.y += rowBounds.height;
			bounds.height -= rowBounds.height;
			dir = "h";
		}

		this.layoutNodes(row, rowBounds, dir, nodeOps);

		return bounds;
	},

	layoutNodes: function layoutNodes(row, rowBounds, dir, nodeOps) {
		if (row.length === 0) {
			return;
		}
		
		var node = row.shift(),
			nodeBounds = {
				x: rowBounds.x,
				y: rowBounds.y,
				width: rowBounds.width,  //adjusted below depending on dir
				height: rowBounds.height //adjusted below depending on dir
			};

		if (dir === "h") {
			nodeBounds.width = nodeOps.getDisplayArea(node) / rowBounds.height;
			nodeOps.setBounds(node, nodeBounds);
			rowBounds.x += nodeBounds.width;
			rowBounds.width -= nodeBounds.width;
		} else {
			nodeBounds.height = nodeOps.getDisplayArea(node) / rowBounds.width;
			nodeOps.setBounds(node, nodeBounds);
			rowBounds.y += nodeBounds.height;
			rowBounds.height -= nodeBounds.height;
		}

		this.layoutNodes(row, rowBounds, dir, nodeOps);
	},
	
	minMaxSum: function minMaxSum(areaCalc) {
		return function (previousValue, currentValue, index, array) {
			return { 
				min: Math.min(previousValue.min, areaCalc(currentValue)), 
				max: Math.max(previousValue.max, areaCalc(currentValue)),
				sum: previousValue.sum + areaCalc(currentValue)
			};
		};
	},
	
	shallowCopy: function shallowCopy(obj) {
		var copy = (this instanceof Array) ? [] : {},
			prop;
		
		for (prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				copy[prop] = obj[prop];
			}
		} 
		
		return copy;
	}
	
};