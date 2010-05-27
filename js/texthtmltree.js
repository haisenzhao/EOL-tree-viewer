function TextHTMLTree(html, prependAncestors) {
	prependAncestors = prependAncestors !== undefined ? prependAncestors : false;
	
	this.currentNodeId = jQuery('a.lastone:first', html).attr('href').replace("/pages/", "");

	if (prependAncestors) {
		//root at a dummy node, parent of all kingdoms
		this.id = 0;
		this.name = "Life";
		this.data = {};
		this.children = [];
		this.parent = null;
		this.depth = 0;
		
		//add the kingdom subtrees
		var root = this;
		jQuery('> ul > li', html).each(function () { //this selector does not seem to work in a Firefox greasemonkey script
			root.children.push(TextHTMLTree.prototype.createSubtree(this, 1));
			
			jQuery.each(root.children, function (i, child) {
				child.parent = root;
			});
		});
		
	} else {
		//root at the current node
		var lastone = TextHTMLTree.prototype.createSubtree(jQuery('li.lastone', html)[0], 1);
		this.id = lastone.id;
		this.name = lastone.name;
		this.data = lastone.data;
		this.children = lastone.children;
		this.parent = null;
		this.depth = 0; //give this subtree relative depths and let the caller update depths relative to their parent node
		
		jQuery.each(this.children, function (i, child) {
			child.parent = this;
		});
	}
}


/* 
 * Creates a subtree using some html <li> element from http://eol.org/navigation/show_tree_view/[id]
 * html is expected to be the <li> element of the desired root node
 */
TextHTMLTree.prototype.createSubtree = function (html, depth) {
	var currentNode = jQuery('> span a:first', html); //this selector does not seem to work in a Firefox greasemonkey script
	//var href = currentNode.attr('href');
	var href=currentNode[0].pathname; //whether pathname includes the leading slash seems to be browser-dependent
	if (href.charAt(0) !== "/") {
		href = "/" + href;
	}
	var node = {
		data: {
			path: href,
			$area: 1
		},
		id: href.slice(href.lastIndexOf('/') + 1),
		name: currentNode.text(),
		
		children: [],
		depth: depth
	};

	//loop through the children and add them
	jQuery('> ul > li, > div > ul > li', html).each(function () {
		node.children.push(TextHTMLTree.prototype.createSubtree(this, depth + 1));
		
		jQuery.each(node.children, function (i, child) {
			child.parent = node;
		});
	});
	
	return node;
};