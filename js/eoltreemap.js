EOLTreeMap.config = {
	levelsToShow: 1,
	titleHeight: 22,
	offset:2
};

function EOLTreeMap(container) {

	this.rootId = container.id;
	jQuery(container).addClass("treemap-container");
	this.api = new EolApi();
	this.controller.api = this.api;
	this.nodeSelectHandlers = [];
	
	//create a stump tree, so view() has something to graft to.
	this.tree = { taxonID:"24974884",  scientificName:"Animalia" };
	EOLTreeMap.prepareForTreeMap(this.tree);
	
	/* Using controller.onBeforeCompute to set this.shownTree before plot is 
	 * called, where it's needed for leaf calc.  But can't give controller 
	 * a field referring back to this EOLTreeMap because the reference cycle appears 
	 * to break Nicolas' JIT class system (it causes an infinite recursion in 
	 * $unlink())
	 */
	var that = this;
	this.controller.setShownTree = function(json) {
		this.shownTree = json;
		that.shownTree = json;
	}
	
	jQuery(".selectable").live("mouseenter", function() {
		that.select(this.id);
	});
	
	jQuery(".selectable").live("mouseleave", function() {
		that.select(null);
	});
}

EOLTreeMap.prototype = new TM.Squarified(EOLTreeMap.config);
EOLTreeMap.prototype.constructor = EOLTreeMap;

EOLTreeMap.prototype.show = function (id) {
	//TODO: once graft() is working, and there's a stump to start from, I can just call view() instead of show()
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
};

EOLTreeMap.prototype.select = function(id) {
	var node = TreeUtil.getSubtree(this.tree, id);
	jQuery.each(this.nodeSelectHandlers, function(index, handler) {
		handler(node);
	});
};

/*
 * Override of TM.view.  Fetches nodes (and their lineage) instead of just assuming they're 
 * already in the tree. For example, when the user jumps to a different classification
 * or loads a bookmarked URL.
 */
EOLTreeMap.prototype.view = function(id) {
	var that = this;

	post = jQuery.extend({}, this.controller);
	post.onComplete = function() {
		that.loadTree(id);
		jQuery("#" + that.config.rootId).focus();
	};
	
	var node = TreeUtil.getSubtree(this.tree, id);
	if (!node) {
		this.api.hierarchy_entries(id, function (json) {
			that.graft(that.tree, json, function (newNode) {
				TreeUtil.loadSubtrees(newNode, post);
			});
		});
	} else {
		TreeUtil.loadSubtrees(node, post);
	}
};

/* 
 * Adds an EOL hierarchy entry to a subtree, fetching its ancestors as necessary 
 * json: the hierarchy entry
 * subtree: a subtree containing this entry
 * callback: callback(node_in_tree_for_json)
 */
EOLTreeMap.prototype.graft = function (subtree, json, callback) {
	var that = this;
	if(!subtree.children || subtree.children.length === 0) {
		//the ancestor's full node hasn't been fetched yet.  Get it, then try again.
		this.api.hierarchy_entries(subtree.taxonID, function (fullNode) {
			EOLTreeMap.prepareForTreeMap(fullNode);
			jQuery.extend(true, subtree, fullNode);
			that.graft(subtree, json, callback);
		});
	} else {
		var childMatch = subtree.children.filter(function (child) {return child.taxonID == json.taxonID })[0];
		if (childMatch) {
			//found the location of the hierarchy entry
			EOLTreeMap.prepareForTreeMap(json);
			jQuery.extend(true, childMatch, json);
			callback(childMatch);
		} else {
			//try the next ancestor on json's array
			var nextAncestorID = json.ancestors.filter(function (ancestor) {return ancestor.parentNameUsageID == subtree.taxonID })[0].taxonID;
			var nextAncestor = subtree.children.filter(function (child) {return child.taxonID == nextAncestorID })[0];
			this.graft(nextAncestor, json, callback);
		}
	}
};

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
	
	var imageAR = image.naturalWidth / image.naturalHeight;
	
	if (imageAR >= containerAR) {
		//image aspect ratio is wider than container: fit height, center width overlap
		var calcWidth = (container.innerHeight() / image.naturalHeight) * image.naturalWidth;
		image.height = container.innerHeight();
		image.width = calcWidth; //force IE to maintain aspect ratio
		jQuery(image).css("marginLeft",  (container.innerWidth() - calcWidth) / 2);
	}
	else {
		//image aspect ratio is taller than container: fit width, center height overlap
		var calcHeight = (container.innerWidth() / image.naturalWidth) * image.naturalHeight;
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
		if (json.id === this.shownTree.id) {
			box = this.breadcrumbBox(json, coord) + this.bodyBox(html, coord);
		} else {
			box = this.headBox(json, coord) + this.bodyBox(html, coord);
		}
	}

	return this.contentBox(json, coord, box);
};

EOLTreeMap.prototype.contentBox = function(json, coord, html) {
    var c = {};
    for(var i in coord) c[i] = coord[i] + "px";
    return "<div class=\"content selectable\" style=\"" + this.toStyle(c) 
       + "\" id=\"" + json.id + "\">" + html + "</div>";
};

EOLTreeMap.prototype.breadcrumbBox = function(json, coord) {
    var config = this.config, offst = config.offset;
    var c = {
      'height': config.titleHeight + "px",
      'width': (coord.width - offst) + "px",
      'left':  offst / 2 + "px"
    };
    var breadcrumbs = "";
    jQuery.each(json.ancestors, function (index, ancestor) {
    	breadcrumbs += "<a class='breadcrumb ancestor selectable' href='#" + ancestor.taxonID + "' id='" + ancestor.taxonID + "'>" + ancestor.scientificName + "</a> > ";
    	//TODO make these selectable so they are shown in the detail view.  I guess this means I have to make them div.content?  Or make a new class .selectable.  Probably that.
    });
    breadcrumbs += "<a class='breadcrumb' href='http://www.eol.org/" + json.taxonConceptID + "'>" + json.name + "</a>";
    return "<div class=\"head\" style=\"" + this.toStyle(c) + "\">" + breadcrumbs + "</div>";
};

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
	
	//kgu: sorting by area (required for treemap), then name.  Most of the time areas are all going to be the same.
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
	if (!this.Color.allow && node != null && this.leaf(node)) {
		this.insertBodyContent(node, body);
	}
};

EOLTreeMap.prototype.controller.onBeforeCompute = function(tree){
	this.setShownTree(tree);
};

EOLTreeMap.prototype.controller.onAfterCompute = function (tree) {
	/*
	 * Adding these elements to the tree in the plotting (createBox, etc...) 
	 * functions or in onCreateElement breaks the tree traversal in 
	 * initializeElements, so I have to add them here
	 */
	
	//Wrap an EOL link around all head divs and a navigation hash link around all of the body divs
	var that = this;
	jQuery("#" + tree.id).find("div .content").each(function (index, element) {
		var node = TreeUtil.getSubtree(tree, this.id);
		var elem1 = jQuery(this).children()[0];
		var elem2 = jQuery(this).children()[1];
		
		if (node && elem1) {
			jQuery(elem1).wrap("<a class='head' href=http://www.eol.org/" + node.taxonConceptID + "></a>");
			if (elem2) {
				jQuery(elem2).wrap("<a class='body' href=#" + node.id + "></a>");
			}
		}
	});

}

EOLTreeMap.prototype.controller.request = function (nodeId, level, onComplete) {
	//TODO: this only gets one level of descendants.  Check the level param for how many levels we should be getting. (Find out if it is relative or absolute depth.)
	this.api.hierarchy_entries(nodeId, function (json) {
		EOLTreeMap.prepareForTreeMap(json);
		onComplete.onComplete(nodeId, json);
	});
};

EOLTreeMap.prototype.controller.insertBodyContent = function (node, container) {
	var that = this;
	
	var placeholder = new Image();
	placeholder.src = "images/ajax-loader.gif";
	jQuery(container).html(placeholder);
	
	if (!node.apiContentFetched) {
		this.api.decorateNode(node, function () {
			node.apiContentFetched = true;
			that.insertBodyContent(node, container);
		});
		return;
	}
	
	if (node.image) {
		if (node.image.image) {
			this.insertImage(node.image.image, container, function(){});
		} else {
			if (!node.image.thumb) {
				node.image.thumb = new Image();
				node.image.thumb.src = node.image.eolThumbnailURL;
			}
			this.insertImage(node.image.thumb, container, function(){
				if (node.image.thumb.naturalWidth < jQuery(container).innerWidth()) {
					node.image.image = new Image();
					node.image.image.src = node.image.eolMediaURL;
					that.insertImage(node.image.image, container, function(){});
				}
			});
		}
	} else {
		jQuery(container).html("No image available");
	}

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
};

EOLTreeMap.prototype.controller.leaf = function (node) {
	//FIXME: this is redundant, but I can't put a reference to this EOLTreeMap in the controller, for the reason given in the constructor.
	return node.children.length === 0 ||
			(node.ancestors.length >= this.shownTree.ancestors.length + this.levelsToShow);
};

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
};


