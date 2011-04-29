var squarifiedTreemap = {

	doLayout: function doLayout(parent, nodeOps, recursive) {
		var layoutBounds = nodeOps.getLayoutBounds(parent),
			children = nodeOps.getLayoutChildren(parent),
			layoutArea = layoutBounds.width * layoutBounds.height,
			totalChildArea = children.reduce(function (accumulate, value) {return accumulate + nodeOps.getDisplayArea(value); }, 0),
			scale = layoutArea / totalChildArea,
			child,
			layoutObjects = [];

		if (children && layoutArea > 0) {
			//wrap the children up with a object that stores their area, to avoid a bunch of extra calculation
			for (child = 0; child < children.length; child++) {
				layoutObjects.push({node: children[child], displayArea: scale * nodeOps.getDisplayArea(children[child])});
			}
			
			layoutObjects.sort(function (a, b) { return b.displayArea - a.displayArea; }); //sort by area, descending
			this.squarify(layoutObjects, [], layoutBounds, nodeOps);

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

		if (this.worst(row, w) >= this.worst(row.concat([c]), w)) {
			this.squarify(children.slice(1), row.concat([c]), bounds, nodeOps);
		} else {
			newBounds = this.layoutRow(row, bounds, nodeOps);
			this.squarify(children, [], newBounds, nodeOps);
		}
	},

	worst: function worst(row, w) {
		if (row.length === 0) { 
			return Number.MAX_VALUE; 
		}

		var r = {
			min: Number.MAX_VALUE,
			max: -Number.MAX_VALUE,
			sum: 0
		};
		
		function minMaxSum(previousValue, currentValue, index, array) {
			return { 
				min: Math.min(previousValue.min, currentValue.displayArea), 
				max: Math.max(previousValue.max, currentValue.displayArea),
				sum: previousValue.sum + currentValue.displayArea
			};
		};

		r = row.reduce(minMaxSum, r);

		return Math.max(w * w * r.max / (r.sum * r.sum), r.sum * r.sum / (w * w * r.min));
	},
	
	layoutRow: function layoutRow(row, bounds, nodeOps) {
		var rowBounds = {
				x: bounds.x,
				y: bounds.y,
				width: 0,
				height: 0
			},
			rowSum = row.reduce(function (accumulate, value) {return accumulate + value.displayArea; }, 0),
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
			nodeBounds.width = node.displayArea / rowBounds.height;
			nodeOps.setBounds(node.node, nodeBounds);
			rowBounds.x += nodeBounds.width;
			rowBounds.width -= nodeBounds.width;
		} else {
			nodeBounds.height = node.displayArea / rowBounds.width;
			nodeOps.setBounds(node.node, nodeBounds);
			rowBounds.y += nodeBounds.height;
			rowBounds.height -= nodeBounds.height;
		}

		this.layoutNodes(row, rowBounds, dir, nodeOps);
	}
};