import { getEnv } from '~/lib/env';

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

export type HojinLookupResult = {
  verified: boolean;
  name?: string;
  prefecture?: string;
  city?: string;
  message?: string;
};

function parseHojinXml(xml: string): HojinLookupResult {
  const countMatch = xml.match(/<count>(\d+)<\/count>/);
  const count = countMatch ? parseInt(countMatch[1], 10) : 0;

  if (count === 0 || xml.includes('該当するデータがありません')) {
    return { verified: false, message: '法人番号が見つかりません' };
  }

  const name = xml.match(/<name>([^<]*)<\/name>/)?.[1]?.trim();
  const prefecture = xml.match(/<prefectureName>([^<]*)<\/prefectureName>/)?.[1]?.trim();
  const city = xml.match(/<cityName>([^<]*)<\/cityName>/)?.[1]?.trim();

  return { verified: true, name, prefecture, city };
}

/** Verify corporate number via 国税庁 法人番号 Web-API (optional) */
export async function verifyCorporateNumber(
  corporateNumber: string,
  locals?: RuntimeLocals
): Promise<HojinLookupResult> {
  const applicationId = getEnv('HOJIN_BANGO_API_TOKEN', locals);
  if (!applicationId) {
    return { verified: true, message: 'API未設定のため形式チェックのみ' };
  }

  try {
    const url = new URL('https://api.houjin-bangou.nta.go.jp/4/num');
    url.searchParams.set('id', applicationId);
    url.searchParams.set('number', corporateNumber);
    url.searchParams.set('type', '12');
    url.searchParams.set('history', '0');

    const res = await fetch(url.toString());

    if (!res.ok) {
      return { verified: false, message: '法人番号の確認に失敗しました' };
    }

    const xml = await res.text();
    return parseHojinXml(xml);
  } catch (e) {
    console.error('[hojin-bango]', e);
    return { verified: false, message: '法人番号APIへの接続に失敗しました' };
  }
}
