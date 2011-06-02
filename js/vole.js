var vole = (function () {
	var init = jQuery.Deferred().resolve(),
		areaModel = {},
		views = {},
		layout = squarifiedTreemap,
		viewDepth = 1,
		max_depth = 5,
		containerID = "",
		displayRoot;
	
	function viewURL(url, container) {
		/*
		 * TODO maybe add some intelligence here to map html urls (like
		 * eol.org/pages/1 or tolweb.org/1) to API urls (like
		 * eol.org/api/hierarchy_entries/1.0/33311700.json or
		 * http://tolweb.org/onlinecontributors/app?service=external&page=xml/TreeStructureService&node_id=1&page_depth=1
		 */
		
		//TODO view treebase nexml: http://treebase.org/treebase-web/phylows/tree/TB2:Tr9274?format=nexml
		
		var params = {
				url:url,
				mode:"native"
			};
		
		jQuery.get("proxy.php", params).done(function (response) {
			vole.view(response);
		});
	}
	
	function viewString(string, container) {
		var xml = jQuery.parseXML(string);
		//note that (at least) chrome doesn't throw a parse error for malformed xml.  have to check for a valid document. 
		if (xml.xmlStandalone) {
			vole.view(xml);
			return;
		}
		
		//TODO? parse newick strings?	
	}
	
	function viewTree(tree, container) {
		views.current.show(tree, getTemplateHelper(tree), container);
	}
	
	function getTemplateHelper(tree) {
		if (tree.taxonConceptID) {
			return new EolTemplateHelper();
		}
		
		if (tree.xmlStandalone) {
			//xml helpers
			if (jQuery(tree).children("tree").children("node")) {
				//tolweb, probably. TODO validate?  Also TODO: handle a node (without its tree) too?
				return new TolWebHelper();
			}
			
			//TODO handle nexml here
		}
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
						//TODO find a reasonably good URL regex.  for now, just testing for "http://"
						if (tree.indexOf("http://") === 0) {
							viewURL(tree, visContainer);
							jQuery(containerID).trigger("vole_view", tree);
						} else {
							viewString(tree, visContainer);
						}
					} else {
						viewTree(tree, visContainer);
					}
				}
			});
		},
		
		loadTemplate: function loadTemplate(templateURL) {
			var defer = jQuery.get(templateURL).done(function (template) {
				jQuery(document).ready(function() {
					jQuery('head').append(template);
				});
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

vole.loadTemplate('templates/_nested.tmpl.html');
vole.loadTemplate('templates/_right_panel.tmpl.html');
