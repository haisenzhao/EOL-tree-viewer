"use strict";
var jQuery, window;

function FlashXMLTree(xml) {
	this.setTree(xml);
	console.log("transformed tree: ");
	console.log(this);
}

FlashXMLTree.prototype.getTaxonPageURL = function (taxonID) {
	return "http://" + window.location.host + "/taxa/" + taxonID;
};

FlashXMLTree.prototype.setTree = function (xml) {
	console.log("transforming xml tree to JSON");
	
	//assemble the ancestry
	var tree = this;
	var node = tree;
	jQuery('results ancestry node', xml).each(function () {
		if (tree.id === undefined) {
			node = tree.xmlNodeToTreeNode(this);
			tree.id = node.id;
			tree.name = node.name;
			tree.data = node.data;
			tree.children = node.children;
			node = tree;
			// tree.id = jQuery('taxonID', this).text();
			// tree.name = jQuery('nameString', this).text();
			// tree.data = {
				// rankName: jQuery('rankName', this).text(),
				// valid: jQuery('valid', this).text(),
				// enable: jQuery('enable', xml).text(),
			// };
			//tree.children = [ ];
		} else {
			node.children = [tree.xmlNodeToTreeNode(this)];
			node = node.children[0];
		}
	});
	
	//add the current node
	var currentElement = jQuery('results current node', xml).get(0);
	node.children = [this.xmlNodeToTreeNode(currentElement)];
	node = node.children[0];
	
	//add the current node's children
	jQuery('results children node', xml).each(function () {
		var leaf = tree.xmlNodeToTreeNode(this); 
		leaf.data.area = 1; //the child is (at least temporarily) a leaf, so it needs an area for treemap
		node.children.push(leaf);
	});
	
};

FlashXMLTree.prototype.xmlNodeToTreeNode = function (xml) {
	console.log("transforming xml node to JSON: " + jQuery('taxonID', xml).text());
	return {
		id: jQuery('taxonID', xml).text(),
		name: jQuery('nameString', xml).text(),
		data: {
			rankName: jQuery('rankName', xml).text(),
			valid: jQuery('valid', xml).text(),
			enable: jQuery('enable', xml).text()
		},
		children: [ ]
	};
};