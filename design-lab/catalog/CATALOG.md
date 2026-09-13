# Fishy starter aquascaping catalog

This catalog has exactly 20 entries: 10 supplier-labelled aquarium wood types/styles and 10 distinct aquatic plant species or cultivars. `catalog.json` is the canonical machine-readable deliverable.

## Reading the data

- Every source URL was opened during research. Plant care values appear only when stated by Tropica on that plant's product page; their provenance is stored in the entry.
- `geometry` values are non-executable art-direction suggestions for Fishy's future procedural visualizer. A two-number array is a suggested visual interval, not an implemented min/max contract. Unlabelled linear controls use normalized local asset units (NLU): `1` spans the authored asset's chosen bounding extent, never a physical centimetre or tank size. `*Deg` controls are local degrees; count/node/patch controls are instance counts; qualitative controls such as density, taper, coverage, roughness, or darkness are unitless proportions. String values are suggested modes. Published plant dimensions stay in the source-provenanced `care` fields and must not scale geometry without a documented conversion layer.
- Wood names are trade labels/styles. They are not scientific names, and similar forms may be sold under overlapping names. No wood entry is certified safe merely because it looks like the source asset. Confirm the exact seller product, preparation guidance, sharp edges, buoyancy, tannins, and livestock fit.

## Wood references

| ID | Name | Distinct visual role | Source |
| --- | --- | --- | --- |
| `wood-spider` | Spider Wood | pale fine branching/root crown | [Aquatic Motiv](https://aquaticmotiv.com/products/spider-wood) |
| `wood-manzanita` | Manzanita Aquarium Driftwood | blond coarse-textured stump/branch | [Manzanita Burlworks](https://manzanita.com/aqwood.htm) |
| `wood-mopani` | Mopani Wood | dense two-tone chunky forks | [Petco / Zoo Med](https://www.petco.com/product/zoo-med-aquatic-natural-mopani-wood-6-8-length-1055810) |
| `wood-cholla` | Cholla Wood | hollow perforated cactus lattice | [Flip Aquatics](https://flipaquatics.com/products/cholla-wood) |
| `wood-red-moor` | Red Moor Wood | pre-assembled tangled fine limbs | [Aquasabi](https://www.aquasabi.com/Red-Moor-Wood) |
| `wood-malaysian-driftwood` | Malaysian Driftwood | dark rugged foundation mass | [Bulk Reef Supply](https://www.bulkreefsupply.com/malaysian-driftwood-ultum-nature-systems.html) |
| `wood-talawa` | Talawa Wood | streamlined, textured directional root | [Aquasabi](https://www.aquasabi.com/Talawa-Wood) |
| `wood-ghost` | UNS Ghost Wood | light robust architectural branches | [Aquasabi](https://www.aquasabi.com/Ghost-Wood) |
| `wood-dragon` | Dragon Wood | gnarled hole-rich trunk | [Aquasabi](https://www.aquasabi.com/Dragon-Wood) |
| `wood-ancient-juniper` | Ancient Juniper Wood (layout reference) | weathered flow-aligned branches | [Tropica Layout 114](https://tropica.com/ProductMedia/Layouts/L114/1071_UK.pdf) |

## Plant references

| ID | Name | Form / use | Direct source |
| --- | --- | --- | --- |
| `plant-micranthemum-monte-carlo` | *Micranthemum tweediei* 'Monte Carlo' | bright creeping foreground carpet | [Tropica](https://tropica.com/en/plants/plantdetails/Micranthemumtweediei'MonteCarlo'(025)/22880) |
| `plant-anubias-petite` | *Anubias barteri* 'Petite' | miniature wood/rock epiphyte | [Tropica](https://tropica.com/en/plants/plantdetails/Anubiasbarteri'Petite'(101H)/4554) |
| `plant-vesicularia-weeping` | *Vesicularia ferriei* 'Weeping' | drooping attached moss | [Tropica](https://tropica.com/en/articles/vesicularia-ferriei-weeping/) |
| `plant-bucephalandra-bukit-kelam` | *Bucephalandra pygmaea* 'Bukit Kelam' | wavy-leaf rhizome epiphyte | [Tropica](https://tropica.com/en/plants/plantdetails/Bucephalandrapygmaea'BukitKelam'(139TC)/28393) |
| `plant-alternanthera-mini` | *Alternanthera reineckii* 'Mini' | compact red-violet stem block | [Tropica](https://tropica.com/en/plants/plantdetails/Alternantherareineckii'Mini'(023CTC)/4439) |
| `plant-cryptocoryne-wendtii-green` | *Cryptocoryne wendtii* 'Green' | grounded green rosette | [Tropica](https://tropica.com/en/plants/plantdetails/Cryptocorynewendtii'Green'(109TC)/19226) |
| `plant-eleocharis-pusilla-mini` | *Eleocharis pusilla* 'Mini' | short grass carpet | [Tropica](https://tropica.com/en/plants/plantdetails/Eleocharispusilla'Mini'(132BTC)/4571) |
| `plant-fissidens-fontanus` | *Fissidens fontanus* | tight featherlike moss | [Tropica](https://tropica.com/en/plants/plantdetails/Fissidensfontanus(002F)/4390) |
| `plant-glossostigma-elatinoides` | *Glossostigma elatinoides* | very low fine carpet | [Tropica](https://tropica.com/en/plants/plantdetails/Glossostigmaelatinoides(045ATC)/4470) |
| `plant-bolbitis-heudelotii` | *Bolbitis heudelotii* | lobed root-mounted fern | [Tropica](https://tropica.com/en/plants/plantdetails/Bolbitisheudelotii(006)/4406) |

The plants span carpet, rhizome epiphyte, moss, rosette, compact stem, grass, and fern forms. Care data remains source-scoped rather than generalized across look-alikes or names.
