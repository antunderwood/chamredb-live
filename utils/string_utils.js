function extractPhenotype(phenotypeString) {
  const re = "(confers resistance to drug class:|confers resistance to antibiotic:|confers resistance to subclass|confers resistance to) (.+)";
  const match = phenotypeString.match(re);
  conferType = match[1].replace(":","")
  conferValues = match[2]
  return [conferType, conferValues];
}

module.exports = { extractPhenotype };