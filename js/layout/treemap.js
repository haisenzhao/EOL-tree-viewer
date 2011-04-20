var squarifiedTreemap = {

	doLayout: function doLayout(childContainer, areaCalc, setBounds) {
		var layoutBounds = {
				x: 0,
				y: 0,
				width: childContainer.width(),
				height: childContainer.height()
			},
			children = jQuery.makeArray(childContainer.children("div.node")), //TODO pass children and bounds in separately so we don't have to assume childContainer is a jQuery object?
			layoutArea = layoutBounds.width * layoutBounds.height,
			totalChildArea = children.reduce(function (accumulate, value) {return accumulate + areaCalc(value); }, 0),
			scale = layoutArea / totalChildArea,
			scaledAreaCalc = function (node) {
				return scale * areaCalc(node);
			};

		if (children && layoutArea > 0) {
			children.sort(function (a, b) { return areaCalc(b) - areaCalc(a); }); //sort by area, descending
			this.squarify(children, [], layoutBounds, scaledAreaCalc, setBounds);

			jQuery.each(children, function () {
				var container = jQuery(this).children("div.body");
				squarifiedTreemap.doLayout(container, areaCalc, setBounds);
			});
		}
	},	

	squarify: function squarify(children, row, bounds, areaCalc, setBounds) {
		var c = children[0],
			w = Math.min(bounds.width, bounds.height),
			newBounds;

		if (children.length === 0) {
			if (row.length !== 0) {
				this.layoutRow(row, bounds, areaCalc, setBounds);
			}
			return;	
		}

		if (this.worst(row, w, areaCalc) >= this.worst(row.concat([c]), w, areaCalc)) {
			this.squarify(children.slice(1), row.concat([c]), bounds, areaCalc, setBounds);
		} else {
			newBounds = this.layoutRow(row, bounds, areaCalc, setBounds);
			this.squarify(children, [], newBounds, areaCalc, setBounds);
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
	
	layoutRow: function layoutRow(row, bounds, areaCalc, setBounds) {
		var rowBounds = {
				x: bounds.x,
				y: bounds.y,
				width: 0,
				height: 0
			},
			rowSum = row.reduce(function (accumulate, value) {return accumulate + areaCalc(value); }, 0),
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

		this.layoutNodes(row, rowBounds, dir, areaCalc, setBounds);

		return bounds;
	},

	layoutNodes: function layoutNodes(row, rowBounds, dir, areaCalc, setBounds) {
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
			nodeBounds.width = areaCalc(node) / rowBounds.height;
			setBounds(node, nodeBounds);
			rowBounds.x += nodeBounds.width;
			rowBounds.width -= nodeBounds.width;
		} else {
			nodeBounds.height = areaCalc(node) / rowBounds.width;
			setBounds(node, nodeBounds);
			rowBounds.y += nodeBounds.height;
			rowBounds.height -= nodeBounds.height;
		}

		this.layoutNodes(row, rowBounds, dir, areaCalc, setBounds);
	},
	
	minMaxSum: function minMaxSum(areaCalc) {
		return function(previousValue, currentValue, index, array) {
			return { 
				min:Math.min(previousValue.min,areaCalc(currentValue)), 
				max:Math.max(previousValue.max,areaCalc(currentValue)),
				sum:previousValue.sum + areaCalc(currentValue)
			};
		};
	}
};