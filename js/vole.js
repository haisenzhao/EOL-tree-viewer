var vole = {
	api: new EolApi(),
	templateHelper: new EolTemplateHelper(),
	viewDepth: 2,
	layout: squarifiedTreemap,
		
	init: function (callback) {
		jQuery.get('templates/_nested.tmpl.html', function(templates) {
			jQuery('head').append(templates);
			callback();
		});
	},
	
	/* gets the hierarchy_entries to some depth and displays them all */
	view: function view(id) {
		vole.viewIncremental(id, vole.viewDepth, jQuery("#container"));
	},

	/* gets the hierarchy_entries one level at a time and only fetches children
	 * if the parent is not too small. Nodes are displayed as soon as they
	 * are fetched.
	 */
	viewIncremental: function viewIncremental(id, depth, container) {
		vole.api.hierarchy_entries(id).done(function(json){
			var root = jQuery('#root').tmpl(json, vole.templateHelper);
			container.append(root);
			vole.fetchChildren(root[0], depth);
		});
	},
	
	fetchChildren: function fetchChildren(node, depth) {
		var childContainer = jQuery(node).children("div.body").first();
		
		if (depth > 0 && childContainer.width() > 50 && childContainer.height() > 50) {
			childContainer.empty().append("<img src='images/ajax-loader.gif'>");
			
			vole.api.hierarchySubtree(node.id, 1).done(function(json) {
				json.children.sort(function (a, b) { return a.scientificName.localeCompare(b.scientificName) });
				var children = jQuery('#node').tmpl(json.children, vole.templateHelper);
						
				childContainer.empty().append(children);
				vole.doLayout(node, false);
						
				children.filter("div.node").each(function() {
					vole.fetchChildren(this, depth - 1);
				});
			});
		} else {
			var image = jQuery(vole.templateHelper.getImage(node)).appendTo(childContainer);
			image.load(function() {
				//assuming no scaling has been done yet, setting 'natural' dims for browsers that don't set them
				this.naturalWidth = this.naturalWidth || this.width;
				this.naturalHeight = this.naturalHeight || this.height;

				if (jQuery(this).hasClass("resizable")) {
					this.resizeToFill();
				}
			});
		}
	},
	
	doLayout: function doLayout(parent, recursive) {
		var nodeOps = jQuery.extend({}, vole.NodeOps, vole.DOMOps, vole.templateHelper);
		vole.layout.doLayout(parent, nodeOps, recursive);
	}
}

vole.NodeOps = {
	getArea: function(node) {return 1;}, //will be replaced with a function from a source helper
	
	scalingFunction: Math.sqrt,
	
	getDisplayArea: function(node) {return this.scalingFunction(this.getArea(node))},
}

vole.DOMOps = {
	setBounds: function setBounds(node, bounds) {
		bounds = {
			x:Math.round(bounds.x),
			y:Math.round(bounds.y),
			width:Math.round(bounds.width),
			height:Math.round(bounds.height)
		}
		var borderWidth = 1;
		//TODO check actual border width once at startup
		
		node = jQuery(node);
		node.css({'left':bounds.x, 'top':bounds.y});
		node.height(bounds.height - 2 * borderWidth);
		node.width(bounds.width - 2 * borderWidth);
		node.resize();
	},

	/* takes a DOM div.node and returns its div.node children (not the 
	 * immediate DOM children, which would just be the header and body 
	 * container) 
	 */
	getLayoutChildren: function getLayoutChildren(node) {
		var childContainer = jQuery(node).children("div.body").first();
		return jQuery.makeArray(childContainer.children("div.node"));
	},

	/* takes a DOM div.node and returns the bounds of its child container */
	getLayoutBounds: function getLayoutBounds(node) {
		var childContainer = jQuery(node).children("div.body").first();
		return {
			x: 0,
			y: 0,
			width: childContainer.width(),
			height: childContainer.height()
		};
	}
};

jQuery(document).ready(function() {
	vole.init(function() {
		vole.view('28670753');
	});
});

jQuery("div.node, a.breadcrumb.ancestor").live("click", function(){
	var container = jQuery("#container").empty();
	vole.view(this.id);
	return false; //only innermost node handles event
});

jQuery(window).resize(function resize() {
	//trigger resize on the layout root
	jQuery("div.root").resize();
	return false;
});

jQuery("div.node").live("resize", function () {
	//redo layout
	vole.doLayout(this, false);
	jQuery("div.body > img.resizable", this).resize();
	return false;
});

jQuery("img.resizable").live("resize", function () {
	this.resizeToFill();
	return false;
});

HTMLImageElement.prototype.resizeToFill = function resizeToFill() {
	var jq = jQuery(this),
		container = this.parentElement,
		imageAR = this.naturalWidth / this.naturalHeight,
		containerAR = container.clientWidth / container.clientHeight,
		overlapPercent;

	if (imageAR >= containerAR) {
		//image aspect ratio is wider than container: fit height
		jq.css("top", "auto");
		jq.css("height", "100%");

		//center overlapping width
		jq.css("width", "auto");
		overlapPercent = 50 * (imageAR / containerAR - 1);
		jq.css("left", -overlapPercent + "%");
	} else {
		//image aspect ratio is taller than container: fit width
		jq.css("left", "auto");
		jq.css("width", "100%");

		//center overlapping height
		jq.css("height", "auto");
		overlapPercent = 50 * (containerAR / imageAR - 1);
		jq.css("top", -overlapPercent + "%");
	}
};
