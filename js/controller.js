function EOLTreeMapController(rootId) {
	this.rootId = rootId;
	this.levelsToShow = 1; //number of levels to show at once
	this.titleHeight = 22; //taxon name container height
	this.offset = 6; //node body padding 
	this.borderWidth = 1; //makes layout account for treemap.css border width //TODO make this change in one place.
	this.minFontSize = 10; //taxon names will shrink to fit until they reach this size
			
	this.Color = {
		allow: true,
		minValue: 0,
		maxValue: 1,
		minColorValue: [0, 0, 0],
		maxColorValue: [0, 192, 0]
	};
	
	this.Tips = {
		allow: true,
		offsetX: 20,
		offsetY: 20,
		onShow: function(tooltip, node, isLeaf, domElement) {
			var statsDisplay = jQuery("<ul><li>descendants:<span id='tip_total_descendants'></span></li><ul><li>descendants with text:<span id='tip_total_descendants_with_text'></span></li><li>descendants with images:<span id='tip_total_descendants_with_images'></span></li></ul><li>text</li><ul><li>trusted text:<span id='tip_total_trusted_text'></span></li><li>unreviewed text:<span id='tip_total_unreviewed_text'></span></li></ul><li>images</li><ul><li>trusted images:<span id='tip_total_trusted_images'></span></li><li>unreviewed images:<span id='tip_total_unreviewed_images'></span></li></ul></ul>");
			
			jQuery('#tip_total_descendants', statsDisplay).text(node.total_descendants + 1);
				
			node.total_descendants_with_text && jQuery('#tip_total_descendants_with_text', statsDisplay).text(node.total_descendants_with_text).append(" (" + Math.round(100 * node.total_descendants_with_text / (node.total_descendants + 1)) + "%)");
			node.total_descendants_with_images && jQuery('#tip_total_descendants_with_images', statsDisplay).text(node.total_descendants_with_images).append(" (" + Math.round(100 * node.total_descendants_with_images / (node.total_descendants + 1)) + "%)");
			node.total_trusted_text && jQuery('#tip_total_trusted_text', statsDisplay).text(node.total_trusted_text);
			node.total_unreviewed_text && jQuery('#tip_total_unreviewed_text', statsDisplay).text(node.total_unreviewed_text);
			node.total_trusted_images && jQuery('#tip_total_trusted_images', statsDisplay).text(node.total_trusted_images);
			node.total_unreviewed_images && jQuery('#tip_total_unreviewed_images', statsDisplay).text(node.total_unreviewed_images);
		
			jQuery(tooltip).html(statsDisplay);
		}
	};
	
	//note: adding 1 to node.total_descendants everywhere because node.total_descendants_with_text and total_descendants_with_images include the node itself.
	this.stats = {
		none: {
			name: "None",
			func: function (taxon) {
				return 1.0;
			}
		},
		total_descendants: {
			name: "Descendants",
			func: function (taxon) {
				return taxon.total_descendants + 1;
			}
		},
		total_descendants_with_text: {
			name: "Descendants w/text",
			func: function (taxon) {
				return taxon.total_descendants_with_text;
			}
		},
		pct_descendants_with_text: {
			name: "% descendants w/text",
			func: function (taxon) {
				return 100 * taxon.total_descendants_with_text / (taxon.total_descendants + 1);
			}
		},
		total_descendants_with_images: {
			name: "Descendants w/images",
			func: function (taxon) {
				return taxon.total_descendants_with_images;
			}
		},
		pct_descendants_with_images: {
			name: "% descendants w/images",
			func: function (taxon) {
				return 100 * taxon.total_descendants_with_images / (taxon.total_descendants + 1);
			}
		},
		total_trusted_text: {
			name: "Text (trusted)",
			func: function (taxon) {
				return taxon.total_trusted_text;
			}
		},
		total_unreviewed_text: {
			name: "Text (unreviewed)",
			func: function (taxon) {
				return taxon.total_unreviewed_text;
			}
		},
		pct_trusted_text: {
			name: "% Text trusted",
			func: function (taxon) {
				return 100 * taxon.total_trusted_text / (taxon.total_trusted_text + taxon.total_unreviewed_text);
			}
		},
		total_trusted_images: {
			name: "Images (trusted)",
			func: function (taxon) {
				return taxon.total_trusted_images;
			}
		},
		total_unreviewed_images: {
			name: "Images (unreviewed)",
			func: function (taxon) {
				return taxon.total_unreviewed_images;
			}
		},
		pct_trusted_images: {
			name: "% Images trusted",
			func: function (taxon) {
				return 100 * taxon.total_trusted_images / (taxon.total_trusted_images + taxon.total_unreviewed_images);
			}
		},
		depth: {
			name: "classification depth",
			func: function (taxon) {
				return taxon.getDepth();
			}
		},
		iucn: {
			name: "IUCN status",
			func: function (taxon) {
				var color;
				if (taxon.iucn) {
					color = EOLTreeMapController.iucnColorMap[taxon.iucn.description];
				}

				return color || EOLTreeMapController.iucnColorMap["default"];
			}
		}
	};
	
	this.scale = {
		indentity: {
			name: "No scaling",
			func: function (value) {
				return value;
			}
		},
		log: {
			name: "Log",
			func: Math.log
		},
		sqrt: {
			name: "Square root",
			func: Math.sqrt
		}
	};
	
	this.optionsForm = EOLTreeMapController.bindOptionsForm(this);
	this.colorVariableSelect = jQuery("#colorVariable", this.optionsForm);
}

EOLTreeMapController.prototype = jQuery.extend(true, {}, TM.innerController, TM.config);

EOLTreeMapController.prototype.onDestroyElement = function (content, tree, isLeaf, leaf) {
	if (leaf.clearAttributes) { 
		//Remove all element events before destroying it.
		leaf.clearAttributes(); 
	}
};

EOLTreeMapController.prototype.onCreateElement = function (content, node, isLeaf, head, body) {  
	if (!node) {
		return;
	}
	
	//ignore isLeaf parameter, JIT.each is wrong about this.  Use this.isLeafElement(content)
	if (this.isLeafElement(content)) {
		if (!(jQuery("#" + this.rootId).hasClass("hide-images"))) {
			this.insertBodyContent(node, body);
		}
	}
};

EOLTreeMapController.prototype.onBeforeCompute = function(tree){
	var that = this;
	
	//collect extremes of stats for the current view
	jQuery.each(this.stats, function (key, stat) {
		stat.min = Number.MAX_VALUE;
		stat.max = -Number.MAX_VALUE;
	});

	TreeUtil.eachLevel(tree, 0, this.levelsToShow, function(node) {
      	jQuery.each(that.stats, function (key, stat) {
			var value = stat.func(node);
			if (value != undefined && !isNaN(value)) {
				stat.min = Math.min(stat.min, value);
				stat.max = Math.max(stat.max, value);
			}
		});
	});
	
	this.updateVariableRange();
};

EOLTreeMapController.prototype.onAfterCompute = function (tree) {
	/*
	 * Adding these elements to the tree in the plotting (createBox, etc...) 
	 * functions or in onCreateElement breaks the tree traversal in 
	 * initializeElements, so I have to add them here
	 */
	
	//Wrap an EOL link around all head divs and a navigation hash link around all of the body divs
	var that = this;
	jQuery("#" + tree.id).find("div .content").each(function (index, element) {
		var node = TreeUtil.getSubtree(tree, this.id);
		
		if (node) {
			var body = jQuery(this).children()[1];
			var head = null;
			
			if (body) {
				head = jQuery(this).children()[0];
			} else {
				body = jQuery(this).children()[0];
				head = jQuery(body).contents()[0];
			}
			
			if (head && node.taxonConceptID) {
				jQuery(head).wrapInner("<a class='head' target='_blank' href=http://www.eol.org/" + node.taxonConceptID + " onclick='window.event.stopPropagation();'></a>");
			
				if (that.colorVariableSelect.val() === "iucn" && node.iucn && node.iucn.description) {
					//background color is handled by the JIT, just setting foreground (overrides css)
					var color = EOLTreeMapController.iucnForegroundColorMap[node.iucn.description];
					if (color) {
						jQuery("a.head", head).css("color", color);
					}
				}
			}
		}
	});
	
	jQuery(".treemap-container > div.content div.content > div.head").each(function (index, element) {
		var fontsize = jQuery(this).css("font-size").replace("px","");
		while(this.scrollWidth > this.offsetWidth && fontsize > that.minFontSize) {
			fontsize -= 1;
			jQuery(this).css("font-size", fontsize + "px");
		}
	});
}

EOLTreeMapController.prototype.request = function (nodeId, level, onComplete) {
	var controller = this;
	this.api.fetchNode(nodeId, function (json) {
		
		if (level > 0 && json.children && json.children.length > 0) {
			var childrenToCallBack = json.children.length;
			
			jQuery(json.children).each(function (i, child) {
				controller.request(child.taxonID, level - 1, {onComplete: function (id, childJSON){
					child.merge(childJSON);
					childrenToCallBack -= 1;
					if (childrenToCallBack === 0) {
						onComplete.onComplete(nodeId, json);
					}
				}});
			});
		} else {
			onComplete.onComplete(nodeId, json);
		}
	});
};

EOLTreeMapController.prototype.insertBodyContent = function (node, container) {
	var that = this;
	
	if (jQuery(container).children().length === 0) {
		var placeholder = new Image();
		placeholder.src = "images/ajax-loader.gif";
		jQuery(container).html(placeholder);
	}
	
	if (!node.apiContentFetched) {
		this.api.decorateNode(node, function () {
			node.apiContentFetched = true;
			that.insertBodyContent(node, container);
		});
		return;
	}
	
	if (node.image) {
		if (!node.image.image) {
			node.image.image = new Image();
			node.image.image.src = node.image.eolMediaURL || node.image.mediaURL || "";
			node.image.image.lowsrc = node.image.eolThumbnailURL || "";
		}
		
		jQuery(node.image.image).addClass("body-image");
		this.insertImage(node.image.image, container, function(){});
	} else {
		jQuery(container).html("<div class='body-image'>No image available.<p><a href='http://www.eol.org/content/page/help_build_eol#images' target='_blank'>Click here to help EOL find one.</a></p></div>");
	}

};

EOLTreeMapController.prototype.insertImage = function (image, container, callback) {
	if (image.complete || image.readyState == "complete") {
		//have to set these for IE.  (They already exist in other browsers...)
		if (!image.naturalHeight || !image.naturalWidth) {
			image.naturalWidth = image.width;
			image.naturalHeight = image.height;
		}
		
		EOLTreeMap.resizeImage(image, container);
		jQuery(container).html(image);
		callback();
	} else {
		jQuery(image).load(function handler(eventObject) {
			if (!image.naturalHeight || !image.naturalWidth) {
				image.naturalWidth = image.width;
				image.naturalHeight = image.height;
			}
			
			EOLTreeMap.resizeImage(image, container);
			jQuery(container).html(image);
			callback();
		});
		
		jQuery(image).error(function handler(eventObject) {
			jQuery(container).html("There was an error loading this image.");
			callback();
		});
	}
};

EOLTreeMapController.prototype.isLeafElement = function(element) {
	var jqElement = jQuery(element);
	return jqElement.children('div').length <= 1 || jqElement.children('div').length === 2 && jqElement.children('div').children('div').length === 0;
}

EOLTreeMapController.prototype.updateVariableRange = function(){
	//update range to current [min,max] if the fields are empty
	if (this.optionsForm) {
		var minValue = jQuery("#colorVariableMinValue", this.optionsForm).val();
		var maxValue = jQuery("#colorVariableMaxValue", this.optionsForm).val()
		
		if (minValue.length === 0) {
			this.Color.minValue = this.stats[this.colorVariableSelect.val()].min;
		} else {
			this.Color.minValue = parseInt(minValue);
		}
		
		if (maxValue.length === 0) {
			this.Color.maxValue = this.stats[this.colorVariableSelect.val()].max;
		} else {
			this.Color.maxValue = parseInt(maxValue);
		}
			
		this.updateVariableDisplay();
	}
}

EOLTreeMapController.prototype.updateVariableDisplay = function() {
	jQuery("#colorVariableMinLabel").text(this.Color.minValue.toPrecision(3));
	jQuery("#colorVariableMaxLabel").text(this.Color.maxValue.toPrecision(3));
	jQuery("#colorGradient stop[offset='0']").attr("stop-color", EOLTreeMapController.$rgbToHex(this.Color.minColorValue));
	jQuery("#colorGradient stop[offset='1']").attr("stop-color", EOLTreeMapController.$rgbToHex(this.Color.maxColorValue));
}

EOLTreeMapController.bindOptionsForm = function (controller) {
	var form = jQuery(EOLTreeMapController.optionsForm);
	
	var svg = jQuery("#gradientBar", form)[0];
	if (!svg || !(svg.namespaceURI == "http://www.w3.org/2000/svg")) {
		//svg not supported
		jQuery("#color-display", form).hide();
	}
	
	/** helper function to map a color value from [0,1] to [0,255] */
	var mapTo255 = function(colorValue) {
		return colorValue * 255;
	};
	
	//add stats to the select lists
	var colorVariableList = jQuery("#colorVariable", form);
	var sizeVariableList = jQuery("#sizeVariable", form);
	jQuery.each(controller.stats, function (key, stat) {
		var option = jQuery("<option>").val(key).text(stat.name);
		colorVariableList.append(option);
		sizeVariableList.append(option.clone());
	});
	sizeVariableList.val("total_descendants");
	colorVariableList.val("none");
	
	var scaleVariableList = jQuery("#sizeScaling", form);
	jQuery.each(controller.scale, function (key, func) {
		var option = jQuery("<option>").val(key).text(func.name);
		scaleVariableList.append(option);
	});
	scaleVariableList.val("sqrt");
	
	//on change, update Color.minValue and Color.maxValue
	colorVariableList.change(function(eventObject) {
		controller.updateVariableRange();
		
		//show the appropriate legend for the current selection
		jQuery("#gradient-legend" , form).hide();
		jQuery("#iucn-legend" , form).hide();
		
		switch (eventObject.currentTarget.value) {
			case "none": 
				break;
			case "iucn": 
				jQuery("#iucn-legend" , form).show();
				break;
			default: 
				jQuery("#gradient-legend" , form).show();
		}
	});
	colorVariableList.change();

	//init values and handle changes for other controls
	jQuery("#depth", form).val(controller.levelsToShow);
	jQuery("#depth", form).change(function() {
		controller.levelsToShow = parseInt(this.value);
	});
	
	jQuery("#displayImages", form)[0].checked = true;
	jQuery("#displayImages", form).change(function() {
		if (this.checked) {
			jQuery("#" + controller.rootId).removeClass("hide-images");
		} else {
			jQuery("#" + controller.rootId).addClass("hide-images");
		}
	});
	
	jQuery("#colorVariableMinValue", form).val("");
	jQuery("#colorVariableMinValue", form).change(function() {
		controller.updateVariableRange();
	});
	
	jQuery("#colorVariableMaxValue", form).val("");
	jQuery("#colorVariableMaxValue", form).change(function() {
		controller.updateVariableRange();
	});
	
	jQuery("#minColor", form).val(EOLTreeMapController.$rgbToHex(controller.Color.minColorValue));
	jQuery("#minColor", form).change(function() {
		controller.Color.minColorValue = jQuery.map(this.color.rgb, mapTo255);
		controller.updateVariableDisplay();
	});
	
	jQuery("#maxColor", form).val(EOLTreeMapController.$rgbToHex(controller.Color.maxColorValue));
	jQuery("#maxColor", form).change(function() {
		controller.Color.maxColorValue = jQuery.map(this.color.rgb, mapTo255);
		controller.updateVariableDisplay();
	});
	
	return form[0];
}

EOLTreeMapController.optionsForm = 
	"<form name='treemap' onsubmit='return false;'>" +
		"<fieldset><legend>Treemap options</legend>" +
			"<div>Maximum depth: <input id='depth' type='text' name='depth' size='3' /></div>" +
			"<div>Display images: <input id='displayImages' type='checkbox' name='displayImages' /></div>" +
			"<fieldset><legend>Size mapping</legend>" +
				"<div><label class='col col1'>Variable:</label><select id='sizeVariable' name='sizeVariable'></select></div>" + 
				"<div><label class='col col1'>Scaling:</label><select id='sizeScaling' name='sizeScaling'></select></div>" +
			"</fieldset>" +
			"<fieldset><legend>Color mapping</legend>" +
				"<div class='row'><label class='col col1'>Variable:</label><select id='colorVariable' name='colorVariable'></select></div>" + 
				"<div id='colorVariableRange' class='row'><label class='col col1'>Variable min:</label><input class='col col2' id='colorVariableMinValue' type='text' name='minValue' size='6' /><label class='col col3'>max:</label><input class='col col4' id='colorVariableMaxValue' type='text' name='maxValue' size='6' /></div>" + 
				"<div id='colorRange' class='row'><label class='col col1'>Color min:</label><input id='minColor' class='color col col2' size='6' /><label class='col col3'>max:</label><input id='maxColor' class='color col col4' size='6' /></div>" + 
				"<div id='color-display'>" + 
					"<div id='gradient-legend'><svg id='gradientBar'><rect x='0' y='0' width='100%' height='100%' fill='url(#colorGradient)'/><linearGradient id='colorGradient'><stop offset='0' stop-color='white'/><stop offset='1' stop-color='black'/></linearGradient></svg><div><span id='colorVariableMinLabel'>min</span><span id='colorVariableMaxLabel'>max</span><br/></div></div>" +
					"<img id='iucn-legend' src='images/Status_iucn3.1.svg' height=100px />" +
				"</div>" + 
			"</fieldset>" +
		"</fieldset>" +
	"</form>";

EOLTreeMapController.$rgbToHex = function(srcArray, array){
    if (srcArray.length < 3) return null;
    if (srcArray.length == 4 && srcArray[3] == 0 && !array) return 'transparent';
    var hex = [];
    for (var i = 0; i < 3; i++){
        var bit = (Math.round(srcArray[i]) - 0).toString(16);
        hex.push((bit.length == 1) ? '0' + bit : bit);
    }
    return (array) ? hex : '#' + hex.join('');
};

EOLTreeMapController.iucnColorMap = {
	"Least Concern (LC)":"#006666",
	"Near Threatened (NT)":"#006666",
	"Vulnerable (VU)":"#CC9900",
	"Endangered (EN)":"#CC6633",
	"Critically Endangered (CR)":"#CC3333",
	"Extinct in the Wild (EW)":"#000000",
	"Extinct (EX)":"#000000",
	"default":"#888888"
};

EOLTreeMapController.iucnForegroundColorMap = {
	"Least Concern (LC)":"#FFFFFF",
	"Near Threatened (NT)":"#99CC99",
	"Vulnerable (VU)":"#FFFFCC",
	"Endangered (EN)":"#FFCC99",
	"Critically Endangered (CR)":"#FFCCCC",
	"Extinct in the Wild (EW)":"#FFFFFF",
	"Extinct (EX)":"#CC3333",
	"default":"#FFFFFF"
}
