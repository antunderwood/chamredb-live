let jsnx = require("jsnetworkx");
let G = new jsnx.DiGraph();

const chamredb = require("./chamredb.json");
// add nodes
for (node of chamredb.nodes) {
    id = node.id;
    delete node.id;
    G.addNode(id, node);
}
// add edges
for (link of chamredb.links) {
    source = link.source;
    target = link.target;
    delete link.source;
    delete link.target;
    G.addEdge(source, target, link);
}
module.exports = G;
