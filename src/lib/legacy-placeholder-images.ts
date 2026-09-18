/** Verified byte-identical legacy No Image uploads (SHA-256 d8f1fb8e56deeffdfca583bc017a8ce58e10ee44659f8abb1811109456065f9e).
 * Match complete paths so replacement uploads are never hidden. Original records remain intact. */
const legacyPaths = new Set([
  '05bbf8e4-f9d0-402c-b393-8ce208082ebf/1784636217305.png',
  '07620c54-0631-4527-b102-a0ee878fa7cf/1784636167597.png',
  '09c83bbd-0bc2-43a0-824d-68a2c89a850f/1784634709882.png',
  '0a2a1eb1-5444-44eb-9d66-ded733b7a521/1784345180035.png',
  '131a29ec-d90f-4ace-a849-c811fe6d407f/1784635945637.png',
  '13f091c1-18ef-4777-8d1e-ed7b7868c173/1784636024417.png',
  '1847b25e-c613-4950-9f92-dc575e63e405/1784345035368.png',
  '1b2d6c9e-a099-41f1-96a6-92a8e9dd28ce/1784635343415.png',
  '2260da59-7f40-4335-9f72-e5b4f442a0b4/1784636103350.png',
  '2b1d0968-13de-4d9e-9f15-c147b5edbac1/1784344259542.png',
  '3a1824db-0053-4d1e-81c0-42ba857d7b84/1784635618986.png',
  '46909cb1-1ab8-4e46-b88f-cff067f8f30d/1784635860153.png',
  '469e6f1b-e004-4299-9234-0a47312c07e0/1784635896299.png',
  '4ce9b965-dd35-4fbe-8251-72b99aea0829/1784346069124.png',
  '72018f94-dc9c-4d7e-86a5-725eb8437a9d/1784346445205.png',
  '83338ca0-5b98-4684-af8c-a2dde730eb06/1784635986244.png',
  '863c6c65-165e-4699-b6bb-baa414cf6d06/1784344629010.png',
  '9e6a05f1-514a-4cd3-b9fa-5d64fedc2ccb/1784635774732.png',
  'a7c20e6a-c0b9-4dc1-a533-f23add758f2b/1784344443383.png',
  'aaf493fd-b481-404c-b95f-ba9501a461a9/1784344753311.png',
  'd5f1d891-67aa-4a0b-b17d-f743824b0948/1784635683961.png',
  'e30505de-fbdd-4517-902f-199c43ea7ddc/1784636073455.png',
  'f0712d12-349e-4250-b48b-c8f2815b6e20/1784346121663.png',
  'f3a646f6-9123-405e-b288-3e60018bb4db/1784344555196.png',
  'fb79ad8b-cad8-4c1a-b711-9405414d4a5c/1784345995889.png',
]);

export function isLegacyPlaceholder(path: string | null | undefined): boolean {
  return Boolean(path && legacyPaths.has(path));
}

export function actualListingImages<T extends { storage_path: string }>(images: T[] | null | undefined): T[] {
  return (images ?? []).filter((image) => !isLegacyPlaceholder(image.storage_path));
}
