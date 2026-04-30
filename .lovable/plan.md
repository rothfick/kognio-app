## Współdzielona tablica w pokoju sesji

Dodajemy interaktywną tablicę (tldraw) do pokoju sesji — uczeń i tutor rysują na tym samym płótnie w czasie rzeczywistym. Wszyscy uczestnicy widzą zmiany natychmiast. Bez dodatkowych kluczy ani serwerów — całość przez Lovable Cloud (Realtime).

## Co użytkownik zobaczy

- W pokoju sesji nowa zakładka **"Tablica"** obok Czat / Transkrypt / AI Co-pilot.
- Pełnoekranowa tablica z narzędziami tldraw: pióro, kształty, tekst, obrazki (drag&drop), strzałki, gumka, undo/redo, kursory współuczestników.
- Cokolwiek narysuje tutor pojawia się u ucznia w ciągu ~250 ms i odwrotnie.
- Po wejściu spóźniony uczestnik dostaje aktualny stan tablicy (sync-on-join).
- Treść tablicy jest częścią sesji — zostaje, dopóki ktoś jest w pokoju (po rozłączeniu wszystkich snapshot znika; trwałe zapisywanie do bazy jako osobny krok później jeśli potrzebujesz).

## Zakres prac

1. Nowy komponent `src/components/session/SharedWhiteboard.tsx` — owija `<Tldraw>` i synchronizuje store przez Supabase Realtime broadcast (kanał `board-{sessionId}`).
2. Dodanie zakładki "Tablica" w `src/pages/SessionRoom.tsx`.
3. Tłumaczenia PL/EN dla nowej etykiety.

## Szczegóły techniczne

- Biblioteka: `tldraw` (już zainstalowana) + import jej CSS.
- Synchronizacja:
  - Kanał Supabase Realtime per sesja, broadcast (self: false).
  - Lokalna zmiana użytkownika → throttled (~250 ms) wysyłka pełnego `getSnapshot(editor.store)`.
  - Odbiór `snapshot` → `loadSnapshot(...)` z guardem `applyingRemote`, żeby nie tworzyć pętli.
  - Nowy uczestnik po `SUBSCRIBED` wysyła `sync-request`; pierwszy z istniejących odsyła aktualny snapshot.
- Dla MVP snapshot wysyłany jest cały (proste, działa do średnich tablic). Jeśli wystąpią problemy z rozmiarem przy dużych tablicach, w kolejnej iteracji zamienimy na delty (`tldraw` `HistoryEntry`).
- Brak zmian w bazie i brak nowych edge functions.

## Out of scope (na potem)

- Trwałe zapisywanie tablicy do bazy (`session_whiteboards`).
- Kolaboracyjne kursory z avatarami.
- Eksport tablicy do PDF/PNG i dołączanie do raportu AI.
