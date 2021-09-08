const  G = require("./graph.js");

function query(database, id) {
    const source = `${database}:${id}`;
    const matches = [];
    for (const target of G.neighbors(source)){
        const edgeData = G.getEdgeData(source, target);
        const targetData = G.node.get(target);
        matches.push(
            {
                edgeData,
                targetData,
            }
        )
    }
    return matches;
}

module.exports = { query };
