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

/** Optional: verify corporate number via 国税庁 法人番号 Web-API */
export async function verifyCorporateNumber(
  corporateNumber: string,
  locals?: RuntimeLocals
): Promise<HojinLookupResult> {
  const token = getEnv('HOJIN_BANGO_API_TOKEN', locals);
  if (!token) {
    return { verified: true, message: 'API未設定のため形式チェックのみ' };
  }

  try {
    const url = new URL('https://api.houjin-bangou.nta.go.jp/4/name');
    url.searchParams.set('id', corporateNumber);
    url.searchParams.set('type', '12');
    url.searchParams.set('history', '0');

    const res = await fetch(url.toString(), {
      headers: { 'X-API-KEY': token },
    });

    if (!res.ok) {
      return { verified: false, message: '法人番号の確認に失敗しました' };
    }

    const data = (await res.json()) as {
      count?: string;
      corporations?: Array<{
        name?: string;
        prefectureName?: string;
        cityName?: string;
      }>;
    };

    if (data.count === '0' || !data.corporations?.length) {
      return { verified: false, message: '法人番号が見つかりません' };
    }

    const corp = data.corporations[0];
    return {
      verified: true,
      name: corp.name,
      prefecture: corp.prefectureName,
      city: corp.cityName,
    };
  } catch (e) {
    console.error('[hojin-bango]', e);
    return { verified: false, message: '法人番号APIへの接続に失敗しました' };
  }
}
