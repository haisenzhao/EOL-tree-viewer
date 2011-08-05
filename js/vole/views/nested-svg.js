(function () {
	var viewContainer = jQuery("<div class='vole-view-nested-svg'>"),
		headHeight = 20,
		headFontSize = 16,
		borderRadius = 10,
		minScale = 0.4,
		maxScale = 6,
		
		view = {
			name: 'nested-svg',
			getContainer: function() {
				return viewContainer;
			},
			show: function (tree, templateAdapter) {
				var svg = $(".vole-view-nested-svg").svg('get'),
					view;
				
				//firefox svg element doesn't seem to obey the 100% dims, so we'll just make sure it's sized now
				jQuery(svg.root()).width(jQuery(svg.root()).parent().width());
				jQuery(svg.root()).height(jQuery(svg.root()).parent().height());
				
				svg.clear();
				view = node(svg, svg.group({"class": "scene"}), tree, templateAdapter);
				
				//mark the data item with its view depth, so children can tell how deep they are
				jQuery(view).data('depth', 0);
	
				vole.getLayout().doLayout(svg.root(), getNodeOps(), true);
				
				fetchDescendants(jQuery(view), templateAdapter, vole.getViewDepth(), this.layoutOps);
			},
			resize: function () {
//				var root = viewContainer.children("svg");
//				vole.getLayout().doLayout(root[0], getNodeOps(), true);
				//TODO resize the svg element for firefox (which doesn't obey the 100% dims)
			},
			layoutOps: {
				/*
				 * takes a <g class='node'> sets it to the given bounds
				 */
				setBounds: function setBounds(node, bounds) {
					var viewport = node.nearestViewportElement,
						jqNode = jQuery(node),
						border, body, clip, label, image,
						sx, sy,
						bodyScale, nodeScale,
						headHeight;
					
					jqNode.attr("transform", "translate(" + bounds.x + "," + bounds.y + ")");
					bounds.x = bounds.y = 0;
					
					border = jqNode.children("rect");
					border.attr(bounds);
					
					clip = jqNode.children("clipPath").children("rect");
					clip.attr(bounds);
					
					resizeLabel(jqNode, bounds);
					
					label = jqNode.children("text")[0];
					headHeight = label.getBBox().height * label.getTransformToElement(node).a;
					
					//scale down the body so that, when the node is zoomed to full screen, (unresized) text in children is normally sized
					nodeScale = node.getTransformToElement(node.ownerSVGElement).a;
					sx = bounds.width / jQuery(viewport).width();
					sy = bounds.height / jQuery(viewport).height();
					bodyScale = Math.max(sx, sy);
					bodyScale = bodyScale / nodeScale;
					
					body = jqNode.children("g");
					body.attr('transform', "translate(0, " + headHeight + ") scale(" + bodyScale + ")");
					
//					bounds.y = headHeight;
//					bounds.height -= headHeight;
					image = jqNode.children("image");
//					image.attr(bounds);
					image.attr('width', bounds.width);
					image.attr('height', bounds.height - headHeight);
					image.attr('y', headHeight);
				},
			
				/*
				 * takes either the root <svg> element, or a <g class='node'> and returns its child g.nodes
				 */
				getLayoutChildren: function getLayoutChildren(node) {
					var childContainer;
					
					childContainer = jQuery(node).children("g").first(); //whether <svg> or <g class='node'>, the (only) <g> child is now the child container
					
					return jQuery.makeArray(childContainer.children("g"));
				},
			
				/* takes either the root <svg> element, or a <g class='node'> and returns the area in which its child nodes can be laid out */
				getLayoutBounds: function getLayoutBounds(node) {
					var container, matrix, label;
					
					if (node.tagName.toLowerCase() === "svg") {
						container = jQuery(node);
						return {
							x: 0,
							y: 0,
							width: container.width(),
							height: container.height()
						};
					} else {
						container = jQuery(node).children("g");
						matrix = node.getTransformToElement(container[0]);
						label = jQuery(node).children("text")[0];
						return {
							x: 0,
							y: 0,
							width: matrix.a * node.getBBox().width,
							height: matrix.d * (node.getBBox().height - label.getTransformToElement(node).a * label.getBBox().height)
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
		var g = svg.group(container, {"class": "node selectable children-to-fetch", "transform": "translate(0, 0)", "clip-path": "url(#clip" + templateAdapter.getID(data) + ")"}),
			parent;

		border(svg, g, data, templateAdapter);
		clip(svg, g, data, templateAdapter);
		head(svg, g, data, templateAdapter);
		image(svg, g, data, templateAdapter);
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
		svg.rect(clipPath, 0, 0, 0, 0);
		
		return clipPath;
	}
	
	function head(svg, container, data, templateAdapter) {
		return svg.text(container, 0, headFontSize, templateAdapter.getName(data));
	}

	function body(svg, container) {
		return svg.group(container, {"class":"body", "transform": "translate(0, " + headHeight + ")"});
	}
	
	function image(svg, container, data, templateAdapter) {
		var image = svg.image(container, 0, headHeight, 0, 0, "images/empty.png", {"preserveAspectRatio":"xMidYMid slice"}),
			thumbnail = false;
	
		//update the href, assume asynchronous
		templateAdapter.getImageURL(data, thumbnail).done(function (url) {
			if (url) {
				image.href.baseVal = url;
			}
		});
		
		return image;
	}

	/* **********
	 * Updaters *
	 ************/
	
	/**
	 * container: some node div to fetch children within
	 * templateHelper: the tree source
	 */
	function fetchDescendants(container, templateHelper, maxDepth, layoutOps) {
		//get children on the given node, or any descendants marked 'children-to-fetch'
		container
			.filter("g.node.children-to-fetch")
			.add(container.find("g.node.children-to-fetch"))
			.each(function(){
				fetchChildren(this, templateHelper, maxDepth, layoutOps);
			});
	}
	
	function fetchChildren(parentNode, templateAdapter, maxDepth, layoutOps) {
		var parentNode = jQuery(parentNode),
			parentBody = parentNode.children("g.body"),
			data = parentNode.data('node'),
			parentDepth = parentNode.data('depth'),
			parentName = templateAdapter.getName(data),
			svg = $(".vole-view-nested-svg").svg('get'),
			childNode;

		//display children if there is space or if the parent is unnamed 
		if (!parentName || parentDepth < maxDepth) {
			parentNode.addClass("async-wait");
			templateAdapter.getChildrenAsync(data).done(function (children) {
				jQuery.each(children, function(index, child) {
					childNode = node(svg, parentBody, child, templateAdapter);
					jQuery(childNode).data('depth', parentDepth + 1);
				});
				
				vole.getLayout().doLayout(parentNode[0], getNodeOps(), true);
	
				parentNode.removeClass("children-to-fetch async-wait");
				
				if (children.length > 0) {
					parentBody.addClass("children");
				}
	
				fetchDescendants(parentBody, templateAdapter, vole.getViewDepth(), layoutOps);
			});
		}
	}

	/* ****************
	 * Event Handlers *
	 ******************/
	
	jQuery(".vole-view-nested-svg svg").live("mousemove mouseup mousedown", function() {
		var lastX, lastY, dragging, panCount = 0, lastSelection;
		
		return function (event) {
			var svg = this,
			x = event.pageX,
			y = event.pageY,
			node, nodeData,
			scene;
			
			if (event.button == 2) {
				return;
			}
			
			scene = jQuery(".vole-view-nested-svg g.scene");
			
			if (event.type == "mousedown" ) {
				lastX = x;
				lastY = y;
			} else if (event.type == "mouseup" ){
				node = jQuery(event.target).closest("g.node");
				if (node.length > 0 && !dragging) {
					zoomToFit(scene[0], node[0]);
					
					fetchDescendants(node, node.data('templateAdapter'), node.data('depth') + 1, view.layoutOps);
					
					updateLOD(svg);
				}
				
				lastX = lastY = null;
				dragging = false;
				scene.removeClass('panning');
			} else if (event.type == "mousemove" ) {
				if (lastX != null) {
					//pan
					dragging = true;
					scene.addClass('panning'); //this addClass doesn't seem to work. (at least in chrome)
					pan(svg, scene[0], x - lastX, y - lastY);
					updateLOD(svg);
					
					lastX = x;
					lastY = y;
				} else {
					//hover-selection
					node = jQuery(event.target).closest("g.node");
					
					if (node[0] != lastSelection) {
						nodeData = node.data();
						node.trigger('voleSelection', nodeData);
					}
					
					lastSelection = node[0];
				}
			}
			
			return false;
		};
	}());
	
	jQuery(".vole-view-nested-svg svg").live("mousewheel", function(event, delta) {
		zoom(this, delta, event.clientX, event.clientY);
		
		updateLOD(this);
		
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
	
	function zoomToFit(scene, element) {
		var tx = getTransformToFit(scene, element);
		
		scene.transform.baseVal.initialize(tx);
	}
	
	function getTransformToFit(scene, element) {
		var svg = scene.ownerSVGElement,
			box = element.getBBox(),
			m = svg.createSVGMatrix(),
			width = jQuery(svg).width(),
			height = jQuery(svg).height(),
			s;
		
		s = Math.min(width / box.width, height / box.height);
		m = m.scale(s);
		
		m = m.multiply(scene.getTransformToElement(element));
		
		return svg.createSVGTransformFromMatrix(m);
	}
	
	/*
	 * x, y are the desired center of the view, in screen pixels, relative to the upper left corner of the current view
	 */
	function zoom(svg, amount, x, y) {
		var m = svg.createSVGMatrix(),
			scene = jQuery(svg).children("g.scene")[0],
			scale = Math.pow(2, amount/4),
			viewportToScene = svg.getTransformToElement(scene),
			pointInScene = viewportToScene.translate(x,y);

		//move current transform to clicked location (in viewport space)
		m = scene.getTransformToElement(svg);
		m.e=x;
		m.f=y;
		
		m = m.scale(scale); //zoom
		
		m = m.translate(-pointInScene.e, -pointInScene.f); //move clicked point in scene to same position in viewport
		
		scene.transform.baseVal.initialize(svg.createSVGTransformFromMatrix(m));
	}
	
	function pan(svg, scene, dx, dy) {
		var t = svg.createSVGTransform();
		
		t.setTranslate(dx, dy);
		
		scene.transform.baseVal.insertItemBefore(t, 0);
		scene.transform.baseVal.consolidate();
	}
	
	function updateLOD(svg) {
		var node = jQuery(svg).children("g.scene").children("g.node");
		updateSubtreeLOD(node, svg);
	}
	
	function updateSubtreeLOD(node, svg) {
		var body = node.children("g"),
			childNodes,
			scale = body[0].getTransformToElement(svg).a;
		
		//have to show at least the node and label first in order to check isLabelOnScreen(node, svg)
		node.removeClass('hideLabel');

		if (scale < minScale) {
			node.addClass('hideSubtree');
			return; //don't check descendants' visibility
		} else {
			node.removeClass('hideSubtree');
		}
		
		if (scale > maxScale && !isLabelOnScreen(node, svg)) {
			node.addClass('hideLabel').addClass('hideBackground');
		} else {
			node.removeClass('hideBackground');
		}
		
		childNodes = body.children("g");
		
		if (childNodes.length > 0) {
			childNodes.each(function(index, Element) {
				updateSubtreeLOD(jQuery(this), svg);
			});
		}
	}
	
	function isLabelOnScreen(node, svg) {
		var label = node.children("text")[0],
			matrix = label.getTransformToElement(svg),
			svg = jQuery(svg),
			labelBounds = label.getBBox(),
			viewport = {
				x: 0,
				y: 0,
				width: svg.width(),
				height: svg.height()
			};

		labelBounds.x = matrix.a * labelBounds.x + matrix.e;
		labelBounds.y = matrix.d * labelBounds.y + matrix.f;
		labelBounds.width *= matrix.a;
		labelBounds.height *= matrix.d;
		
		return intersect(viewport, labelBounds);
	}
	
	function intersect(r1, r2) {
		return !(r2.x > r1.x + r1.width 
			|| r2.x + r2.width < r1.x
			|| r2.y > r1.y + r1.height
			|| r2.y + r2.height < r1.y);
	}
	
	function resizeLabel(jqNode, bounds) {
		var tx = 5, 
			ty, scale, value, bbox;
		
		//resize labels that run outside the clip
		label = jqNode.children("text");
		bbox = label[0].getBBox();
		if (bbox.width > (bounds.width - 10)) {
			scale = (bounds.width - 10) / bbox.width;
		}
		
		ty = 0;
		value = "translate(" + tx + "," + ty + ")";
		
		if (scale) {
			value += " scale(" + scale + ")";
		}
		
		label.attr("transform", value);
	}
	
	function fadeOut(element) {
		//standard jQuery fadeOut doesn't seem to work on svg, even with jquery.svganim.js plugin
		element = jQuery(element);
		if (element.css('opacity') == 1) {
			element.animate({'opacity':0}, function complete() {
				//note that jQuery().animate is animating the style opacity, not the attribute opacity
				jQuery(this).hide();
			});
		}
	}

	viewContainer.svg({
		onLoad: function(svgwrapper) {
			vole.addView(view.name, view);
		},
		settings: {width:"100%", height: "100%", version: "1.2"}
	});
	
	
})();
