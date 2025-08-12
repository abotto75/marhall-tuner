
// pages/api/match.js
export default async function handler(req, res) {
  const { artist, track } = req.body;

  const genres = ["Pop", "Rock", "Jazz", "Classica", "Country", "Colonne Sonore"]; // esempio
  const subPairs = [{ subId: "pop_dance" }, { subId: "rock_classic" }]; // esempio

  const subIds = subPairs.map(s => s.subId);

  const schema = {
    type: "object",
    properties: {
      genreId: { type: "string", enum: genres },
      subId: { type: "string", enum: subIds.concat([""]) },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string" },
      alternatives: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            genreId: { type: "string", enum: genres },
            subId: { type: "string", enum: subIds.concat([""]) },
            label: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          },
          required: ["genreId", "subId", "label", "confidence"],
          additionalProperties: false
        }
      }
    },
    required: ["genreId", "subId", "confidence", "reason", "alternatives"],
    additionalProperties: false
  };

  // Simulazione risposta
  res.status(200).json({
    genreId: "Rock",
    subId: "rock_classic",
    confidence: 0.92,
    reason: "Classificazione simulata",
    alternatives: [
      { genreId: "Pop", subId: "pop_dance", label: "Pop - Dance Pop", confidence: 0.6 }
    ]
  });
}
