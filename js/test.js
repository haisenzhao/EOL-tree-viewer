$(document).ready(function() {
	var id = jQuery('#current_taxon_concept_id').attr('value');
	console.log("The current_taxon_concept_id is " + id);
	
	displayNode(id, false);
});

function displayNode(id, for_selection) {
    var url = '/navigation/show_tree_view/' + id;
	
	//TODO
	

}