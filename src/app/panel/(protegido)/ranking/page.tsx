import type { Metadata } from 'next';

import { RankingView } from '@/modules/panel/views/ranking.view';

export const metadata: Metadata = { title: 'Ranking por barrio' };

export default function PaginaRanking() {
  return <RankingView />;
}
