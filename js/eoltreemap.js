//TODO: user starts on a non-root node and then enters a URL (or clicks a bookmark, etc) for a node not in this subtree.  JIT fails to find the node.  Need to fetch ancestors of current tree and new tree and graft the two together at their MRCA.
//TODO: only-child "Not Assigned" nodes should be skipped, and their children shown
EOLTreeMap.config = {
	levelsToShow: 1,
	orientation: "v",
	titleHeight: 22,
	offset:2
};

function EOLTreeMap(container) {

	this.rootId = container.id;
	jQuery(container).addClass("treemap-container");
	this.api = new EolApi();
	this.controller.api = this.api;
	this.nodeSelectHandlers = [];
	
	/* Using controller.onBeforeCompute to set this.shownTree before plot is 
	 * called, where it's needed for leaf calc.  But can't give controller 
	 * a field referring back to this EOLTreeMap because the reference cycle appears 
	 * to break Nicolas' JIT class system (it causes an infinite recursion in 
	 * $unlink())
	 */
	var that = this;
	this.controller.setShownTree = function(json) {
		that.shownTree = json;
	}
	
	jQuery("div.content").live("mouseenter", function() {
		console.log("mouse entered " + this.id);
		that.select(this.id);
	});
	
	jQuery("div.content").live("mouseleave", function() {
		console.log("mouse left " + this.id);
		that.select(null);
	});
	
	
}

EOLTreeMap.prototype = new TM.Squarified(EOLTreeMap.config);
EOLTreeMap.prototype.constructor = EOLTreeMap;

EOLTreeMap.prototype.show = function (id) {
	if (this.tree === null) {
		var that = this;
		this.api.hierarchy_entries(id, function (json) {
			EOLTreeMap.prepareForTreeMap(json);
			that.loadJSON(json);
		});
	} else {
		this.view(id);
	}
};

/* 
 * Calls callback(node) when a node is 'selected' (for display, not navigation). 
 * Calls callback(null) when no node is selected.
 */
EOLTreeMap.prototype.addNodeSelectHandler = function(handler) {
	this.nodeSelectHandlers.push(handler);
}

EOLTreeMap.prototype.select = function(id) {
	var node = TreeUtil.getSubtree(this.tree, id);
	this.nodeSelectHandlers.forEach(function(handler) {
		handler(node);
	});
}

EOLTreeMap.prepareForTreeMap = function (apiHierarchy) {
	//set some fields TM needs
	TreeUtil.each(apiHierarchy, function (node) {
		node.id = node.taxonID;
		node.name = node.scientificName;
		node.data = { $area: 1.0 };
		if (!node.children) {
			node.children = [];
		}
	});
}

EOLTreeMap.setAreas = function (tree, computeArea) {
	//go over the whole tree and apply compteArea to nodes
	TreeUtil.each(tree, function (node) {
		node.data.$area = computeArea(node);
	});
};

EOLTreeMap.resizeImage = function (image, container) {
	container = jQuery(container);
	var containerAR = container.innerWidth() / container.innerHeight();
	
	var imageAR = image.width / image.height;
	
	if (imageAR >= containerAR) {
		//image aspect ratio is wider than container: fit height, center width overlap
		var calcWidth = (container.innerHeight() / image.height) * image.width;
		image.height = container.innerHeight();
		image.width = calcWidth; //force IE to maintain aspect ratio
		jQuery(image).css("marginLeft",  (container.innerWidth() - calcWidth) / 2);
	}
	else {
		//image aspect ratio is taller than container: fit width, center height overlap
		var calcHeight = (container.innerWidth() / image.width) * image.height;
		image.width = container.innerWidth();
		image.height = calcHeight; //force IE to maintain aspect ratio
		jQuery(image).css("marginTop",  (container.innerHeight() - calcHeight) / 2);
	}
};


/* Overrides TM.createBox to render a leaf with title and image */
EOLTreeMap.prototype.createBox = function (json, coord, html) {
	var box;
	if (this.leaf(json)) {
		if (this.config.Color.allow) {
			box = this.leafBox(json, coord);
		} else {
			box = this.headBox(json, coord) + this.bodyBox("", coord);
		}
	} else {
		box = this.headBox(json, coord) + this.bodyBox(html, coord);
	}

	return this.contentBox(json, coord, box);
};

///* Overrides TM.bodyBox to remove offset between head box and body box */
//EOLTreeMap.prototype.bodyBox = function(html, coord) {
//    var config = this.config,
//    th = config.titleHeight,
//    offst = config.offset;
//    var c = {
//      'width': (coord.width - offst) + "px",
//      'height':(coord.height - offst - th) + "px",
//      'top':   th + "px",
//      'left':  (offst / 2) + "px"
//    };
//    return "<div class=\"body\" style=\""
//      + this.toStyle(c) +"\">" + html + "</div>";
//};

/* a node is displayed as a leaf if it is at the max displayable depth or if it is actually a leaf in the current tree */
EOLTreeMap.prototype.leaf = function (node) {
	return node.children.length === 0 ||
			(node.ancestors.length >= this.shownTree.ancestors.length + this.controller.levelsToShow);
};

/* Minor edit of processChildrenLayout to sort equal-area nodes alphabetically */
EOLTreeMap.prototype.processChildrenLayout = function (par, ch, coord) {
	//compute children real areas
	var parentArea = coord.width * coord.height;
	var i, totalChArea = 0, chArea = [];
	for (i = 0; i < ch.length; i++) {
		chArea[i] = parseFloat(ch[i].data.$area);
		totalChArea += chArea[i];
	}
	for (i = 0; i < chArea.length; i++) {
		ch[i]._area = parentArea * chArea[i] / totalChArea;
	}
	var minimumSideValue = (this.layout.horizontal())? coord.height : coord.width;
	
	//kgu: inserting custom sort comparator
	ch.sort(function (a, b) {
		var diff = a._area - b._area;
		return diff || a.name.localeCompare(b.name);
	});
	
	var initElem = [ch[0]];
	var tail = ch.slice(1);
	this.squarify(tail, initElem, minimumSideValue, coord);
};

EOLTreeMap.prototype.controller.onDestroyElement = function (content, tree, isLeaf, leaf) {
	if (leaf.clearAttributes) { 
		//Remove all element events before destroying it.
		leaf.clearAttributes(); 
	}
};

EOLTreeMap.prototype.controller.onCreateElement = function (content, node, isLeaf, head, body) {  
	if (!this.Color.allow && node != null && TM.leaf(node)) {
		this.insertBodyContent(node, body);
	}
};

EOLTreeMap.prototype.controller.onBeforeCompute = function(tree){
	this.setShownTree(tree);
};

EOLTreeMap.prototype.controller.onAfterCompute = function (tree) {
	
	//Wrap an EOL link around all head divs and a navigation hash link around all of the body divs
	var that = this;
	jQuery("#" + tree.id).find("div .content").each(function (element) {
		var node = TreeUtil.getSubtree(tree, this.id);
		var elem1 = jQuery(this).children()[0];
		var elem2 = jQuery(this).children()[1];
		
		if (node && elem1) {
			jQuery(elem1).wrap("<a href=http://www.eol.org/" + node.taxonConceptID + ">");
			if (elem2) {
				jQuery(elem2).wrap("<a href=#" + node.id + ">");
			}
		}
	});

}

EOLTreeMap.prototype.controller.request = function (nodeId, level, onComplete) {
	var node = this.api.hierarchy_entries(nodeId, function (json) {
		EOLTreeMap.prepareForTreeMap(json);
		onComplete.onComplete(nodeId, json);
	});
};

EOLTreeMap.prototype.controller.insertBodyContent = function (node, container) {
//	if (node.image.image) {
//		//already loaded full size image
//		that.insertImage(node.image.image, container, function(){});
//		return;
//	}
	
	var placeholder = new Image();
	placeholder.src = "images/ajax-loader.gif";
	jQuery(container).html(placeholder);
	
	var that = this;
	this.api.decorateNode(node, function () {
		if (node.image) {
			var thumb = new Image();
			thumb.src = node.image.eolThumbnailURL;
			that.insertImage(thumb, container, function(){
				if (thumb.naturalWidth < jQuery(container).innerWidth()) { //TODO: not sure if image.naturalWidth is supported on all browsers.  Test.
					node.image.image = new Image();
					node.image.image.src = node.image.eolMediaURL;
					that.insertImage(node.image.image, container, function(){});
				}
			});
		} else {
			jQuery(container).html("No image available");
		}
	});
};

EOLTreeMap.prototype.controller.insertImage = function (image, container, callback) {
	if (image.complete) {
		EOLTreeMap.resizeImage(image, container);
		jQuery(container).html(image);
		callback();
	} else {
		jQuery(image).load(function handler(eventObject) {
			EOLTreeMap.resizeImage(image, container);
			jQuery(container).html(image);
			callback();
		});
		
		jQuery(image).error(function handler(eventObject) {
			jQuery(container).html("No image available");
			callback();
		});
	}
}

/* A minor edit to loadSubtrees to make it merge the entire incoming json node 
 * with the existing node, instead of just tacking on the new child array */
TreeUtil.loadSubtrees = function(tree, controller){
    var maxLevel = controller.request && controller.levelsToShow;
    var leaves = this.getLeaves(tree, maxLevel), len = leaves.length, selectedNode = {};
    if (len == 0) 
        controller.onComplete();
    for (var i = 0, counter = 0; i < len; i++) {
        var leaf = leaves[i], id = leaf.node.id;
        selectedNode[id] = leaf.node;
        controller.request(id, leaf.level, {
            onComplete: function(nodeId, tree){
                //var ch = tree.children;
                //selectedNode[nodeId].children = ch;
				jQuery.extend(true, selectedNode[nodeId], tree);
                if (++counter == len) {
                    controller.onComplete();
                }
            }
        });
    }
}
