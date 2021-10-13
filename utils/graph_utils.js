const G = require("./create_graph.js");

function query(database, id) {
    const match_info = {};
    const source = get_node(database, id)
    if (!source){
        return {query: null, match_info: []}
    }
    else {
        // remove nested objects that are not required
        const { alternative_id, duplicate_allele_ids, ...sourceData} = G.node.get(source);
        sourceData.id = source.replace(`${sourceData.database}:`, "");
        match_info['query'] = sourceData;
        match_info['matches'] = [];
        matches = [];
        for (const target of G.neighbors(source)){
            const edgeData = G.getEdgeData(source, target);
            // remove nested objects that are not required
            const { alternative_id, duplicate_allele_ids, ...targetData} = G.node.get(target);
            targetData.id = target.replace(`${targetData.database}:`, "");
            matches.push(
                {
                    edgeData,
                    targetData,
                }
            );
        }
        bestMatches = getBestMatches(matches);
        match_info['matches'] = bestMatches;
        return match_info;
    }
}

function getBestMatches(matches){
    // get unique databases
    const databases= [...new Set(matches.map((match) => (match.targetData.database)))];
    const bestMatches = [];
    for (database of databases) {
        matchesForDatabase = matches.filter((match) => match.targetData.database === database);
        maxIdentity = Math.max(...matchesForDatabase.map((x) => (x.edgeData.identity)));
        if (maxIdentity >= 0.9){
            bestMatch = matchesForDatabase.filter((match) => match.edgeData.identity === maxIdentity)[0];
            bestMatches.push(bestMatch);
        }
    }
    return bestMatches;
}

function get_node(database, id) {
    const composite_id   = `${database}:${id}`;
    if (G.hasNode(composite_id)){
        return composite_id;
    }
    else {
        // search in node_data for id in name, alternative_ids and duplicate_ids
        for (const [node_id, node_data] of G.nodesIter(true)){
            if ('name' in node_data && node_data['name'] === id) {
                return node_id
            }
            if ('alternative_id' in node_data
                && Object.values(node_data['alternative_id']).includes(id)) {
                return node_id
            }
            if (
                'duplicate_allele_ids' in node_data
                && Object.entries(node_data['duplicate_allele_ids']).map((entry) => entry[1]).flat().includes(id)
            ) {
                return node_id
            }
        }
    }
    return null
}

module.exports = { query };
