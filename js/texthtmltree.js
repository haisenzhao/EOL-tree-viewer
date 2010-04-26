function TextHTMLTree(html, prependAncestors) {
	prependAncestors = prependAncestors !== undefined ? prependAncestors : false;

	if (prependAncestors) {
		//root at a dummy node, parent of all kingdoms
		this.id = 0;
		this.name = "Life";
		this.data = {};
		this.children = [];
		
		//add the kingdom subtrees
		var tree = this;
		jQuery('> ul > li', html).each(function() { //this selector does not seem to work in Firefox
			tree.children.push(TextHTMLTree.prototype.getSubtree(this));
		});
		
	} else {
		//root at the current node
		var lastone = TextHTMLTree.prototype.getSubtree(jQuery('li.lastone',html)[0]);
		this.id = lastone.id;
		this.name = lastone.name;
		this.data = lastone.data;
		this.children = lastone.children;
	}
	
	console.log("transformed tree: ");
	console.log(this);
}


/* 
 * Gets a subtree using some html <li> element from http://eol.org/navigation/show_tree_view/[id]
 * html is expected to be the <li> element of the desired root node
 */
TextHTMLTree.prototype.getSubtree = function(html) {
	var currentNode = jQuery('> span a:first',html); //this selector does not seem to work in Firefox
	var href = currentNode.attr('href');
	var node = {
		data: {
			path: href,
			$area: 1
		},
		id: href.replace("/pages/", ""),
		name: currentNode.text(), //TODO this will include the attribution of the name for species nodes (" Linnaeus, 1758").  Keep it?
		
		children: []
	}

	//loop through the children and add them
	jQuery('> ul > li, > div > ul > li', html).each(function() {
		node.children.push(TextHTMLTree.prototype.getSubtree(this));
	});
	
	//if (node.children.length > 0) {
	//	node.data.$area = 0;
	//}
	
	return node;
}