function Taxon(hierarchy_entry, id, name) {
	this.data = {};
	this.merge(hierarchy_entry);

	//make all of the children a Taxon too
	if (hierarchy_entry && hierarchy_entry.children) {
		this.children = [];
		var that = this;
		jQuery.each(hierarchy_entry.children, function(index, child) { 
			var childTaxon = new Taxon(child);
			that.children.push(childTaxon);
			child.parent = that;
		});
	}
	
	this.id = id || hierarchy_entry.taxonID;
	this.name = name || hierarchy_entry.scientificName;
}

Taxon.prototype.getArea = function() {
	return this.data.$area || Math.sqrt(this.total_descendants) || 1.0;
};

Taxon.prototype.getColor = function(){
	return this.data.$color || this.total_descendants_with_text / (this.total_descendants + 1);
};

Taxon.prototype.getDepth = function() {
	return this.parent && this.parent.getDepth() + 1 || 0;
};

Taxon.prototype.merge = function(other) {
	//not using jQuery.extend(this, other) because it copies functions from other.prototype to this
	for (prop in other){
		if (other.hasOwnProperty(prop) && !(other[prop] instanceof Function)) {
			this[prop] = other[prop];
		}
    }
	
	this.setAsParent();
};

Taxon.prototype.setAsParent = function () {
	//TODO try to make children array private and set child.parent in the child setter instead of making the client call this
	if (this.children) {
		var that = this;
		jQuery.each(this.children, function(index, child){
			child.parent = that;
		});
	}
}

Taxon.prototype.leaf = function() {
	return this.children.length === 0;
}