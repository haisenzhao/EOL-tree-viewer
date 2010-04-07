function FlashXMLTree(xml) {
	this.setTree(xml);
	console.log("transformed tree: ");
	console.log(this);
}

FlashXMLTree.prototype.getTaxonPageURL = function(taxonID) {
	return url = "http://" + window.location.host + "/taxa/" + taxonID;
}

FlashXMLTree.prototype.setTree = function(xml) {
	console.log("transforming xml tree to JSON");
	
	//assemble the ancestry
	var tree = this;
	var node = tree;
	$('results ancestry node', xml).each(function() {
		if (tree.id === undefined) {
			node = tree.xmlNodeToTreeNode(this);
			tree.id = node.id;
			tree.name = node.name;
			tree.data = node.data;
			tree.children = node.children;
			node = tree;
			// tree.id = $('taxonID', this).text();
			// tree.name = $('nameString', this).text();
			// tree.data = {
				// rankName: $('rankName', this).text(),
				// valid: $('valid', this).text(),
				// enable: $('enable', xml).text(),
			// };
			//tree.children = [ ];
		} else {
			node.children = [tree.xmlNodeToTreeNode(this)];
			node = node.children[0];
		}
	});
	
	//add the current node
	var currentElement = $('results current node', xml).get(0);
	node.children = [this.xmlNodeToTreeNode(currentElement)];
	node = node.children[0];
	
	//add the current node's children
	$('results children node', xml).each(function() {
		var leaf = tree.xmlNodeToTreeNode(this); 
		leaf.data.area = 1; //the child is (at least temporarily) a leaf, so it needs an area for treemap
		node.children.push(leaf);
	});
	
}

FlashXMLTree.prototype.xmlNodeToTreeNode = function(xml) {
	console.log("transforming xml node to JSON: " + $('taxonID', xml).text());
	return {
		id: $('taxonID', xml).text(),
		name: $('nameString', xml).text(),
		data: {
			rankName: $('rankName', xml).text(),
			valid: $('valid', xml).text(),
			enable: $('enable', xml).text(),
		},
		children: [ ]
	};
}