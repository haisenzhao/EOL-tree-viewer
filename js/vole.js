var vole = (function () {
	var init = jQuery.Deferred().resolve(),
		areaModel = {},
		views = {},
		layout = squarifiedTreemap,
		viewDepth = 1,
		max_depth = 5,
		containerID = "",
		displayRoot,
		urlRegex = /^(?:(?:http[s]?|ftp):\/\/)?([^:\/\s]+)(?::(?:[^\/]*))?((\/[\w\-\.:]+)*\/)([\w\-\.:]+)(\.[^#?\s]+)?(\?([^#]*))?(#(.*))?$/;
	
	function viewURL(url) {
		mapURL(url).done(function(mappedURL) { 
			url = mappedURL || url;
			
			vole.get(url).done(function (response) {
				//TODO check for response "ERROR: invalid url" from proxy
				vole.view(response);
			});
		});
	}
	
	/*
	 * map some (shorter) html urls (like eol.org/pages/1 or tolweb.org/1) to API urls
	 * (like eol.org/api/hierarchy_entries/1.0/33311700.json or
	 * http://tolweb.org/onlinecontributors/app?service=external&page=xml/TreeStructureService&node_id=1&page_depth=1
	 * 
	 * returns a jQuery.Deferred because the eol urls will have to use the api
	 */
	function mapURL(url) {
		var regexResult = urlRegex.exec(url),
			defer = new jQuery.Deferred(),
			url,
			id;
		
		if (regexResult[1] === "tolweb.org" || regexResult[1] === "www.tolweb.org") {
			id = regexResult[4]; //assume the file part is taxon id.  I.e. tolweb.org/optional_name/id
			if (!isNaN(parseInt(id))) {
				url = "http://tolweb.org/onlinecontributors/app?service=external&page=xml/TreeStructureService&page_depth=1&node_id=" + id;
				defer.resolve(url);
			}
		} else if ((regexResult[1] === "eol.org" || regexResult[1] === "www.eol.org") && regexResult[3] === "/pages") {
			id = regexResult[4];
			if (!isNaN(parseInt(id))) {
				EolAdapter.api.hierarchyEntryForPage(id).done(function(hierarchyEntryID) {
					url = EolAdapter.api.buildURL("hierarchy_entries", hierarchyEntryID);
					defer.resolve(url);
				});
			}
		} else {
			defer.resolve(null);
		}
		
		return defer.promise();
	}
	
	function viewString(string) {
		var xml = jQuery.parseXML(string);
		//note that (at least) chrome doesn't throw a parse error for malformed xml.  have to check for a valid document. 
		if (jQuery.isXMLDoc(xml)) {
			vole.view(xml);
			return;
		}
		
		//TODO? parse newick strings?	
	}
	
	function viewTree(tree) {
		views.current.show(tree, getTemplateHelper(tree));
	}
	
	function getTemplateHelper(tree) {
		if (tree.taxonConceptID) {
			return new EolAdapter();
		}
		
		if (jQuery.isXMLDoc(tree)) {
			//xml helpers
			if (tree.documentElement.localName.toLowerCase() === "tree") {
				//assume tolweb, for now.  TODO Will have to do additional checks if I add other trees that start with <tree>
				return new TolWebAdapter();
			} else if (tree.documentElement.localName.toLowerCase() === "nexml") {
				return new NexmlAdapter();
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
				if (typeof tree === "string") {
					if (urlRegex.test(tree)) {
						viewURL(tree);
						jQuery(containerID).trigger("vole_view", tree);
					} else {
						viewString(tree);
					}
				} else {
					viewTree(tree);
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
					
					if (containerID) {
						jQuery(containerID).empty();
						jQuery("<div id=vole-vis-container>").append(views.current.getContainer()).appendTo(containerID);
						jQuery.tmpl('right').appendTo(containerID);
					}
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
				jQuery(containerID).empty();
				
				if (views.current) {
					jQuery("<div id=vole-vis-container>").append(views.current.getContainer()).appendTo(containerID);
				}
				
				jQuery.tmpl('right').appendTo(containerID);
			});
		},
		
		getDisplayRootData: function () {
			return displayRoot;
		},
		
		/** get a URL via vole proxy.  Returns a jqXHR. */
		get: function (url) {
			var params = {url:url, mode:"native"};
			return jQuery.get("proxy.php", params);
		}
	}
})();
