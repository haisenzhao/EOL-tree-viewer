(function () {
	var viewContainer = jQuery("<div class='vole-view-nested-svg'>"),
		headHeight = 20,
		headFontSize = 16,
		borderRadius = 10,
		
		view = {
			name: 'nested-svg',
			getContainer: function() {
				return viewContainer;
			},
			show: function (tree, templateAdapter) {
				var svg = $(".vole-view-nested-svg").svg('get'),
					view;
				
				svg.clear();
				view = node(svg, svg.root(), tree, templateAdapter);
				
				//mark the data item with its view depth, so children can tell how deep they are
				jQuery(view).data('depth', 0);
	
				vole.getLayout().doLayout(svg.root(), getNodeOps(), true);
				
				fetchDescendants(jQuery(view), templateAdapter, vole.getViewDepth(), this.layoutOps);
	
				fetchLeafImages(jQuery(view), templateAdapter);
			},
			resize: function () {
//				var root = viewContainer.children("svg");
//				vole.getLayout().doLayout(root[0], getNodeOps(), true);
				//do nothing for this view.  it will have been zoom/panned.
			},
			layoutOps: {
				/*
				 * takes a <g class='node'> sets it to the given bounds
				 */
				setBounds: function setBounds(node, bounds) {
					var viewport = node.nearestViewportElement,
						node = jQuery(node),
						border, body,
						sx, sy;
					
					node.attr('transform', "translate(" + bounds.x + "," + bounds.y + ")");
					bounds.x = bounds.y = 0;
					
					border = jQuery(node).children("rect.node");
					border.attr(bounds);
					
					//scale down the body so that, when the node is zoomed to full screen, text in children is normally sized
					sx = bounds.width / viewport.clientWidth;
					sy = bounds.height / viewport.clientHeight;
					
					body = jQuery(node).children("g.body");
					body.attr('transform', "translate(0, " + headHeight + ") scale(" + sx + "," + sy + ")");
				},
			
				/*
				 * takes either the root <svg> element, or a <g class='node'> and returns its child g.nodes
				 */
				getLayoutChildren: function getLayoutChildren(node) {
					var childContainer,
						children;
					
					if (node.tagName.toLowerCase() === "svg") {
						childContainer = jQuery(node);
					} else {
						childContainer = jQuery(node).children("g.body").first();
					}
					
					return jQuery.makeArray(childContainer.children("g.node"));
				},
			
				/* takes either the root <svg> element, or a <g class='node'> and returns the area in which its child nodes can be laid out */
				getLayoutBounds: function getLayoutBounds(node) {
					var container;
					
					if (node.tagName.toLowerCase() === "svg") {
						container = jQuery(node);
						return {
							x: 0,
							y: 0,
							width: container.width(),
							height: container.height()
						};
					} else {
						return {
							x: 0,
							y: 0,
							width: node.getBBox().width,
							height: node.getBBox().height - 20
						};
					}
				}
			}
		};
	
	/* ********************
	 * Template functions *
	 **********************/
	//TODO make all of these more jQuery-ish.  Should just be able to create the elements and return them, and let the caller add them to the DOM where they want (remove svg and parent params).  May have to modify jquery.svg plugin.
	//TODO in the end, the only param should really be the node itself
	function node(svg, container, data, templateAdapter) {
		var g = svg.group(container, {"class": "node selectable", "transform": "translate(0, 0)", "clip-path": "url(#clip" + templateAdapter.getID(data) + ")"}),
			parent;

		border(svg, g, data, templateAdapter);
		clip(svg, g, data, templateAdapter);
		head(svg, g, data, templateAdapter);
		body(svg, g);

		jQuery(g).data({
			"node": data,
			"templateAdapter": templateAdapter
		});
		
		return g;
	}
	
	function border(svg, container, data, templateAdapter) {
		return svg.rect(container, 0, 0, 0, 0, borderRadius, borderRadius, {"class":"node selectable", "id":"border" + templateAdapter.getID(data)});
	}
	
	function clip(svg, container, data, templateAdapter) {
		var clipPath = svg.other(container, "clipPath", {id:"clip" + templateAdapter.getID(data)});
		svg.use(clipPath, "#border" + templateAdapter.getID(data));
		
		return clipPath;
	}
	
	function head(svg, container, data, templateAdapter) {
		return svg.text(container, 0, headFontSize, templateAdapter.getName(data));
	}

	function body(svg, container) {
		return svg.group(container, {"class":"body children-to-fetch", "transform": "translate(0, " + headHeight + ")"});
	}

	/* **********
	 * Updaters *
	 ************/
	
	/**
	 * container: some node div to fetch children within
	 * templateHelper: the tree source
	 */
	function fetchDescendants(container, templateHelper, maxDepth, layoutOps) {
		container.find("g.body.children-to-fetch").each(function(){
			fetchChildren(this, templateHelper, maxDepth, layoutOps);
		});
	}
	
	function fetchChildren(parentBody, templateAdapter, maxDepth, layoutOps) {
		var parentBody = jQuery(parentBody),
			parentNode = parentBody.parent()[0],
			data = jQuery(parentNode).data('node'),
			parentDepth = jQuery(parentNode).data('depth'),
			parentName = templateAdapter.getName(data),
			layoutBounds = layoutOps.getLayoutBounds(parentNode),
			svg = $(".vole-view-nested-svg").svg('get'),
			childNode;

		//display children if there is space or if the parent is unnamed 
		if (!parentName || parentDepth < maxDepth) {
			parentBody.addClass("async-wait");
			templateAdapter.getChildrenAsync(data).done(function (children) {
				//parentBody.empty(); 
				//TODO hide background image, if there is one
				
				jQuery.each(children, function(index, child) {
					childNode = node(svg, parentBody, child, templateAdapter);
					jQuery(childNode).data('depth', parentDepth + 1);
				});
				
				vole.getLayout().doLayout(parentNode, getNodeOps(), true);
	
				parentBody.removeClass("children-to-fetch async-wait");
				
				if (children.length > 0) {
					parentBody.addClass("children");
				}
	
				//these both basically happen asynchronously: any node bodies marked "leaf to-fetch" will get images and any "children to-fetch" will get children
				fetchLeafImages(parentNode, templateAdapter);
				fetchDescendants(parentBody, templateAdapter, vole.getViewDepth(), layoutOps);
			});
		} else {
			parentBody.addClass("image-to-fetch");
			fetchLeafImages(parentNode, templateAdapter);
		}
	}

	function fetchLeafImages(container, templateHelper) {
//		jQuery(container).find("div.body.image-to-fetch").each(function(){
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
//			leafBody.removeClass("image-to-fetch");
//		});
	}
	
	/* ****************
	 * Event Handlers *
	 ******************/
	
	jQuery(".vole-view-nested-svg g.node").live('click', function(event) {
		var svg = jQuery(this).parent().closest("svg")[0];
			
		console.log("clicked " + this);
		console.log("before:" + jQuery(svg).attr("viewBox"));
		zoomToFit(svg, this);
		console.log("after:" + jQuery(svg).attr("viewBox"));
		
		fetchDescendants(jQuery(this), jQuery(this).data('templateAdapter'), jQuery(this).data('depth') + 1, view.layoutOps);
		
		return false;
	});

	/* ***************
	 * Misc. Helpers *
	 *****************/
	
	function getNodeOps() {
		return jQuery.extend({}, vole.getAreaModel(), view.layoutOps);
	}
	
	function getRootNode() {
		return jQuery("g.node.root", viewContainer);
	}
	
	function zoomToFit(svg, element) {
		jQuery(svg).attr('viewBox', getViewBox(svg, element));
		//TODO: will want to hide parent background fill, so we don't end up with white-on-white.  jQuery.fadeOut() doesn't work on <rect>, but animating the opacity and then display:none should work.
	}

	function getViewBox(svg, element) {
		var bounds = element.getBBox();

		transform(element.getTransformToElement(svg), bounds);

		return bounds.x + " " + bounds.y + " " + bounds.width + " " + bounds.height;
	}

	function transform(matrix, rect) {
		//note: assuming no skew or rotation, just scale and translation
		
		rect.x = matrix.a * rect.x + matrix.e;
		rect.y = matrix.b * rect.y + matrix.f;

		rect.width = matrix.a * rect.width;
		rect.height = matrix.d * rect.height;
	}
	
	viewContainer.svg(function() {vole.addView(view.name, view);});
})();
