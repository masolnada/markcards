export interface PlantResult {
  latinName: string;
  commonName: string | null;
  score: number;
}

export async function identifyPlant(
  imageBuffer: ArrayBuffer,
  apiKey: string,
): Promise<PlantResult[]> {
  const formData = new FormData();
  formData.append('images', new Blob([imageBuffer], { type: 'image/jpeg' }), 'plant.jpg');
  formData.append('organs', 'auto');

  const response = await fetch(
    `https://my-api.plantnet.org/v2/identify/all?lang=ca&nb-results=10&api-key=${apiKey}`,
    { method: 'POST', body: formData },
  );

  if (!response.ok) {
    throw new Error(`PlantNet API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    results: Array<{
      score: number;
      species: {
        scientificNameWithoutAuthor: string;
        commonNames: string[];
      };
    }>;
  };

  const sorted = [...data.results].sort((a, b) => b.score - a.score);

  // Accumulate until cumulative score >= 0.9, minimum 1
  const filtered: typeof sorted = [];
  let cumulative = 0;
  for (const result of sorted) {
    filtered.push(result);
    cumulative += result.score;
    if (cumulative >= 0.9) break;
  }

  return filtered.map((r) => ({
    latinName: r.species.scientificNameWithoutAuthor,
    commonName: r.species.commonNames[0] ?? null,
    score: r.score,
  }));
}
