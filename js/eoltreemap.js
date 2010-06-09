function EOLTreeMap(container) {

	this.rootId = container.id;
	this.backingTree = null;
	this.api = new EolApi();
	this.controller.api = this.api;
}

EOLTreeMap.prototype = new TM.Squarified(EOLTreeMap.config);
//EOLTreeMap.prototype.constructor = EOLTreeMap;

EOLTreeMap.config = {
	levelsToShow: 1,
	orientation: "v",
	titleHeight: 22
};

EOLTreeMap.prototype.show = function (id) {
	if (this.backingTree === null) {
		var that = this;
		this.api.hierarchy_entries(id, function (json) {
			that.backingTree = json;
			
			//set some fields TM needs
			TreeUtil.each(json, function (node) {
				node.id = node.taxonID;
				node.data = { $area: 1.0 };
				if (!node.children) {
					node.children = [];
				}
			});
			
			that.loadJSON(json);
		});
	} else {
		//TODO.  for now, just replace it
		this.backingTree = null;
		this.show(id);
	}
};

EOLTreeMap.prototype.setAreas = function (tree, computeArea) {
	//go over the whole tree and apply compteArea to nodes
	TreeUtil.each(tree, function (node) {
		node.data.$area = computeArea(node);
	});
};

EOLTreeMap.prototype.controller.onDestroyElement = function (content, tree, isLeaf, leaf) {
	if (leaf.clearAttributes) { 
		//Remove all element events before destroying it.
		leaf.clearAttributes(); 
	}
};

EOLTreeMap.prototype.controller.onCreateElement = function (content, node, isLeaf, head, body) {  
	
	//note that isLeaf will be false when leaves have images, but TM.leaf(node) will be true
	if (!this.Color.allow && TM.leaf(node)) {
		this.insertImage(node, body);
	}
};

EOLTreeMap.prototype.controller.request = function (nodeId, level, onComplete) {
	//TODO
	onComplete.onComplete(nodeId, tree);
};

EOLTreeMap.prototype.controller.insertImage = function (node, body) {
	this.api.decorateNode(node, function () {
		if (node.image) {
			var image = new Image();
			image.src = node.image.eolThumbnailURL;
			//TODO resize image to fit
			
			if (image.complete) {
				EOLTreeMap.resizeImage(image, body);
				jQuery(body).html(image);
			} else {
				jQuery(image).load(function handler(eventObject) {
					EOLTreeMap.resizeImage(image, body);
					jQuery(body).html(image);
					//TODO if the body element is big, consider replacing with full size image
				});
				
				jQuery(image).error(function handler(eventObject) {
					jQuery(body).html("No image available");
				});
			}
		} else {
			jQuery(body).html("No image available");
		}
	});
};

EOLTreeMap.resizeImage = function (image, container) {
	var containerAR = container.innerWidth() / container.innerHeight();
	
	var imageAR = image.width / image.height;
	
	if (imageAR >= containerAR) {
		//image aspect ratio is wider than container: fit height, center width overlap
		var calcWidth = (container.innerHeight() / image.height) * image.width;
		image.height = availableHeight;
		image.width = calcWidth; //force IE to maintain aspect ratio
		jQuery(image).css("marginLeft",  (container.innerWidth() - calcWidth) / 2);
	}
	else {
		//image aspect ratio is taller than container: fit width, center height overlap
		var calcHeight = (container.innerWidth() / image.width) * image.height;
		image.width = container.innerWidth();
		image.height = calcHeight; //force IE to maintain aspect ratio
		jQuery(image).css("marginTop",  (availableHeight - calcHeight) / 2);
	}
};


/*
 * 
 * Node rendering overrides
 *
 */

EOLTreeMap.prototype.createBox = function (json, coord, html) {
	var box;
	if (this.leaf(json)) {
		if (this.config.Color.allow) {
			box = this.leafBox(json, coord);
		} else {
			//TODO get actual image for node
			html = "<img src='images/ajax-loader.gif'>";
			box = this.headBox(json, coord) + this.bodyBox(html, coord);
		}
	} else {
		box = this.headBox(json, coord) + this.bodyBox(html, coord);
	}

	return this.contentBox(json, coord, box);
};

EOLTreeMap.prototype.headBox = function(json, coord) {
	var config = this.config, offst = config.offset;
	var c = {
		'height' : config.titleHeight + "px",
		'width' : (coord.width - offst) + "px",
		'left' : offst / 2 + "px"
	};
	return "<div class=\"head\" style=\"" + this.toStyle(c) + "\">" + json.scientificName + "</div>";
};