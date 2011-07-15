Raphael.fn.nested = {
    tree: function (tree, templateAdapter) {…},
    node: function (node, templateAdapter) {
    	var s = this.set();
    	
    	s.push(this.);
    	
    	return s;
    },
    head: function (node, templateAdapter ) {
    	return this.text(0, 16, templateAdapter.getName(node));
    },
    body: function (node, templateAdapter) {…},
};

(function () {
	var viewContainer = jQuery("<div class='vole-view-nested-raphael'>"),
		svgcanvas = Raphael(viewContainer[0], viewContainer.width(), viewContainer.height()),
		view = {
			name: 'nested-raphael',
			getContainer: function() {
				return viewContainer;
			},
			show: function (tree, templateHelper) {
				svgcanvas.clear();
				
				//TODO create the treemap elements
				
				//TODO mark the data item with its view depth, so children can tell how deep they are
	
				vole.getLayout().doLayout(svgcanvas, getNodeOps(), true);
				
				fetchDescendants(view, templateHelper, vole.getViewDepth(), this.layoutOps);
	
				fetchLeafImages(view, templateHelper);
			},
			resize: function () {
				vole.getLayout().doLayout(svgcanvas, getNodeOps(), true);
			},
			layoutOps: {
//				/*
//				 * takes a <g class='node'> sets it to the given bounds
//				 */
//				setBounds: function setBounds(node, bounds) {
//					var node = jQuery(node),
//						border;
//					
//					node.attr('transform', "translate(" + bounds.x + "," + bounds.y + ")");
//					bounds.x = bounds.y = 0;
//					
//					//UGH, both the jQuery class selector and the attribute contains selector are currently broken for SVG: http://stackoverflow.com/questions/3294553/jquery-selector-svg-incompatible/5759456#5759456
//					//border = jQuery(node).children("rect.node"); //broken
//					//border = jQuery('rect[class~="node"]', node); //broken
//					border = node.children().filter(function() {return this.className.baseVal.indexOf("node") > -1});
//					
//					border.attr(bounds);
//				},
//			
//				/*
//				 * takes either the root <svg> element, or a <g class='node'> and returns its child g.nodes
//				 */
//				getLayoutChildren: function getLayoutChildren(node) {
//					var childContainer,
//						children;
//					
//					if (node.tagName.toLowerCase() === "svg") {
//						childContainer = jQuery(node);
//					} else {
//						//childContainer = jQuery(node).children("g.body").first();
//						childContainer = jQuery(node).children("g").filter(function() {return this.className.baseVal.indexOf("body") > -1}); //jquery class selector is broken in svg
//					}
//					
//					children = jQuery(childContainer).children("g").filter(function() {
//						return this.className.baseVal.indexOf("node") > -1
//					});
//					return jQuery.makeArray(children); //jquery class selector is broken in svg
//				},
//			
//				/* takes either the root <svg> element, or a <g class='node'> and returns the area in which its child nodes can be laid out */
//				getLayoutBounds: function getLayoutBounds(node) {
//					var container;
//					
//					if (node.tagName.toLowerCase() === "svg") {
//						container = jQuery(node);
//						return {
//							x: 0,
//							y: 0,
//							width: container.width(),
//							height: container.height()
//						};
//					} else {
//						container = jQuery(node).children("rect").filter(function() {return this.className.baseVal.indexOf("node") > -1}); //jquery class selector is broken in svg
//						return {
//							x: 0,
//							y: 0,
//							width: container.attr('width'),
//							height: container.attr('height') - 20
//						};
//					}
//				}
			}
		};
	
	/**
	 * container: some node div to fetch children within
	 * templateHelper: the tree source
	 */
	function fetchDescendants(container, templateHelper, maxDepth, layoutOps) {
		container.find("g.body.children.to-fetch").each(function(){
			fetchChildren(this, templateHelper, maxDepth, layoutOps);
		});
	}
	
	function fetchChildren(parentBody, templateHelper, maxDepth, layoutOps) {
		var parentBody = jQuery(parentBody),
			tmplItem = parentBody.tmplItem(),
			parentDepth = tmplItem.data.voleDepth,
			parentNode = parentBody.parent()[0],
			parentName = tmplItem.getName(),
			layoutBounds = layoutOps.getLayoutBounds(parentNode);

		//display children if there is space or if the parent is unnamed 
		if (!parentName || parentDepth < maxDepth && layoutBounds.width > 50 && layoutBounds.height > 50) {
			parentBody.addClass("async-wait");
			tmplItem.getChildrenAsync().done(function (children) {
				jQuery.each(children, function(index, child) {
					child.voleDepth = parentDepth + 1;
				});
				
				var childNodes = jQuery.tmpl('nested-raphael.node', children, templateHelper);
				
				parentBody.empty().append(childNodes);
				
				vole.getLayout().doLayout(parentNode, getNodeOps(), true);
	
				parentBody.removeClass("to-fetch async-wait");
	
				//these both basically happen asynchronously: any node bodies marked "leaf to-fetch" will get images and any "children to-fetch" will get children
				fetchLeafImages(parentNode, templateHelper);
				fetchDescendants(parentBody, templateHelper, vole.getViewDepth(), layoutOps);
			});
		} else {
			parentBody.removeClass("children");
			parentBody.addClass("leaf to-fetch");
			fetchLeafImages(parentNode, templateHelper);
		}
		
		parentBody.removeClass("to-fetch");
	}

	function fetchLeafImages(container, templateHelper) {
//		jQuery(container).find("div.body.leaf.to-fetch").each(function(){
//			var leafBody = jQuery(this),
//				thumbnail = leafBody.width() < 150 && leafBody.height() < 150;
//				tmplItem = leafBody.tmplItem(),
//				image = tmplItem.getImage(thumbnail);
//
//			leafBody.empty().append(image);
//			
//			jQuery(image).load(function() {
//				//assuming no scaling has been done yet, setting 'natural' dims for browsers that don't set them
//				this.naturalWidth = this.naturalWidth || this.width;
//				this.naturalHeight = this.naturalHeight || this.height;
//	
//				if (jQuery(this).hasClass("resizable")) {
//					this.resizeToFill();
//				}
//			});
//
//			leafBody.removeClass("to-fetch");
//		});
	}

	function getNodeOps() {
		return jQuery.extend({}, vole.getAreaModel(), view.layoutOps);
	}
	
//	function getRootElement() {
//		return jQuery("g.node.root", viewContainer);
//	}

	//TODO add methods to setup and tear down the event handlers
//	jQuery("div.node, a.breadcrumb.ancestor").live("click", function() {
//		var tmplItem = jQuery(this).tmplItem(),
//			url = tmplItem.getURL();
//
//		if (url) {
//			vole.view(url); 
//		} else {
//			//TODO try just showing the node before getting the URL?  vole won't trigger a view change event if I do
//			view.show(tmplItem.data, tmplItem.helper);
//		}
//		return false; //only innermost node handles event
//	});

	vole.addView(view.name, view);
})();
