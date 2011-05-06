var vole = (function () {
	var init = jQuery.Deferred().resolve(),
		api = new EolApi(),
		templateHelper = new EolTemplateHelper(),
		basicOps = {},
		views = {},
		layout = squarifiedTreemap,
		viewDepth = 1,
		max_depth = 5,
		containerID = "",
		displayRoot;
	
	/* gets the hierarchy_entries one level at a time and only fetches children
	 * if the parent is not too small. Nodes are displayed as soon as they
	 * are fetched.
	 */
	function viewIncremental(id, depth, container) {
		api.hierarchy_entries(id).done(function(json){
			displayRoot = json;
			var view = jQuery('#root').tmpl(json, templateHelper);
			container.empty().append(view);
			fetchChildren(view[0], depth);
		});
	};
	
	function fetchChildren(node, depth) {
		var childContainer = jQuery(node).children("div.body").first(),
			thumbnail = false,
			image;
		
		if (depth > 0 && childContainer.width() > 50 && childContainer.height() > 50) {
			childContainer.empty().append("<img src='images/ajax-loader.gif'>");
			
			api.hierarchySubtree(node.id, 1).done(function(json) {
				json.children.sort(function (a, b) { return a.scientificName.localeCompare(b.scientificName) });
				var children = jQuery('#node').tmpl(json.children, templateHelper);
						
				childContainer.empty().append(children);
				doLayout(node, false);
						
				children.filter("div.node").each(function() {
					fetchChildren(this, depth - 1);
				});
			});
		} else {
			//small nodes will get a thumbnail image.  (Some of the originals are huge.  Thumbnails appear to have a max of 147 in both dims)
			thumbnail = childContainer.width() < 150 && childContainer.height() < 150;
			
			image = jQuery(templateHelper.getImage(node, thumbnail)).appendTo(childContainer);
			image.load(function() {
				//assuming no scaling has been done yet, setting 'natural' dims for browsers that don't set them
				this.naturalWidth = this.naturalWidth || this.width;
				this.naturalHeight = this.naturalHeight || this.height;

				if (jQuery(this).hasClass("resizable")) {
					this.resizeToFill();
				}
			});
		}
	};
		
	function doLayout(parent, recursive) {
		var nodeOps = jQuery.extend({}, basicOps, views.current.layoutOps, templateHelper);
		layout.doLayout(parent, nodeOps, recursive);
	};
	
	basicOps = {	
		getArea: function(node) {
			return 1; //will be replaced with a function from a source helper
		}, 
				
		scalingFunction: Math.sqrt,
				
		getDisplayArea: function(node) {
			return this.scalingFunction(this.getArea(node));
		},
		
		setAreaFunction: function(func) {
			this.getArea = func;
		}
	};
	
	return {
		view: function view(id) {
			init.done(function() {
				var visContainer = jQuery(containerID).find("#vole-vis-container");
				
				if (visContainer) {
					viewIncremental(id, viewDepth, visContainer);
				}
			});
		},
		
		loadTemplate: function loadTemplate(templateURL) {
			var defer = jQuery.get(templateURL).done(function (template) {
				jQuery('head').append(template);
			});
			
			if (init.isResolved()) {
				init = defer;
			} else {
				init = jQuery.when(init, defer);
			}
		},
		
		setView: function setView(name) {
			init.done(function() {
				if (views[name]) {
					views.current = views[name];
				}
			});
		},
		
		addView: function addView(name, rootTemplateID, nodeTemplateID, layoutOps) {
			if (!views[name]) {
				views[name] = {
					'rootTemplateID': rootTemplateID,
					'nodeTemplateID': nodeTemplateID,
					'layoutOps': layoutOps
				};
			}
		},
		
		setLayout: function setLayout(newLayout) {
			layout = newLayout;
		},
		
		resize: function resize() {
			var root = jQuery("div.node.root"); //TODO add a method to the view to get the root
			doLayout(root, true);
			
			//if the root is also a leaf, resize its image
			root.children("div.body").children("img")[0].resizeToFill();
		},
		
		setViewDepth: function setViewDepth(depth) {
			if (depth >= 0 && depth < max_depth) {
				viewDepth = depth;
			}
		},
		
		setAreaFunction: function(func) {
			basicOps.setAreaFunction(func);
		},
		
		setContainerID: function(id) {
			containerID = "#" + id;
			
			init.done(function() {
				jQuery(containerID).empty().append("<div id='vole-vis-container'>");
				
				jQuery("#right_tmpl").tmpl().appendTo(containerID);
			});
		},
		
		getDisplayRootData: function () {
			return displayRoot;
		}
	}
})();

jQuery(document).ready(function() {
	vole.loadTemplate('templates/_nested.tmpl.html');
	vole.loadTemplate('templates/_right_panel.tmpl.html');
	
	vole.setContainerID("vole-container");
	vole.setView('nested');
	
	vole.setAreaFunction(function(node) {
		return jQuery(node).tmplItem().data.total_descendants + 1;
	});
	
	vole.view('33311700');
});
