var vole = (function () {
	var init = jQuery.Deferred().resolve(),
		api = new EolApi(),
		templateHelper = new EolTemplateHelper(),
		areaModel = {},
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
	
	function viewURL(url, depth, container) {
		templateHelper.getTree(url).done(function (response) {
			views.current.show(response, templateHelper, container);
		});
	}
	
	function viewString(tree, viewDepth, visContainer) {
		//TODO try to figure out the format of the string
		//TODO display the tree
	}
	
	areaModel = {	
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
	
	jQuery(window).resize(function resize() {
		vole.resize();
		return false;
	});
	
	return {
		view: function view(tree) {
			init.done(function() {
				var visContainer = jQuery(containerID).find("#vole-vis-container");
				
				if (visContainer) {
					if (typeof tree === "string") {
						//TODO find a reasonably good URL regex.  for now, just testing for "://"
						if (tree.indexOf("://") > 0) {
							viewURL(tree, viewDepth, visContainer);
						} else {
							viewString(tree, viewDepth, visContainer);
						}
					} else {
						//TODO handle obj tree
					}
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
		
		addView: function addView(name, view) {
			if (!views[name]) {
				views[name] = view;
			}
		},
		
		setLayout: function setLayout(newLayout) {
			layout = newLayout;
		},
		
		getLayout: function getLayout() {
			return layout;
		},
		
		resize: function resize() {
			views.current.resize();
		},
		
		setViewDepth: function setViewDepth(depth) {
			if (depth >= 0 && depth < max_depth) {
				viewDepth = depth;
			}
		},
		
		getViewDepth: function getViewDepth() {
			return viewDepth;
		},
		
		getAreaModel: function() {
			return areaModel;
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
	
	vole.getAreaModel().setAreaFunction(function(node) {
		return jQuery(node).tmplItem().data.total_descendants + 1;
	});
	
	vole.view('http://www.eol.org/api/hierarchy_entries/1.0/33311700');
});
