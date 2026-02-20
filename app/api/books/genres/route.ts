import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/index';
import { book } from '@/db/schema';
import { isNotNull, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const db = await getDbAsync();
    const rows = await db
      .selectDistinct({ genre: book.genre })
      .from(book)
      .where(isNotNull(book.genre))
      .orderBy(book.genre)
      .all();

    // Extract all genres from comma-separated values with filtering
    const allGenres = new Set<string>();
    
    rows.forEach(row => {
      if (row.genre && row.genre.trim() !== '') {
        // Split by comma, semicolon, or slash and process each genre
        const rawGenres = row.genre.split(/[,;/]/)
          .map(g => g.trim())
          .filter(g => g !== '');
        
        // Process each potential genre
        rawGenres.forEach(rawGenre => {
          // Further split by colon if it looks like metadata
          if (rawGenre.includes(':') && 
              (rawGenre.toLowerCase().includes('khz') || 
               rawGenre.toLowerCase().includes('kbps') ||
               rawGenre.toLowerCase().includes('время') ||
               rawGenre.toLowerCase().includes('читает'))) {
            // Skip metadata entries with colons
            return;
          }
          
          const normalized = normalizeGenre(rawGenre);
          if (isValidGenre(normalized)) {
            allGenres.add(normalized);
          }
        });
      }
    });

    // Convert Set to array and sort alphabetically
    const genres = Array.from(allGenres).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ genres });
  } catch (error) {
    console.error('Fetch genres error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Normalize genre: capitalize first letter, lowercase rest
function normalizeGenre(genre: string): string {
  if (!genre || genre.length < 2) return genre;
  
  // Remove leading/trailing punctuation (non-letters, non-digits)
  genre = genre.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+|[^a-zA-Zа-яА-ЯёЁ0-9]+$/g, '');
  
  // Capitalize first letter, lowercase the rest
  return genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
}

// Filter out non-genre strings
function isValidGenre(genre: string): boolean {
  if (!genre || genre.length < 2) return false;
  
  // Filter out technical metadata patterns
  const technicalPatterns = [
    /^\d+$/,
    /^\d+\.\d+/,
    /kbps$/i,
    /khz$/i,
    /hz$/i,
    /^mp3$/i,
    /^wav$/i,
    /^flac$/i,
    /^аудиокнига$/i,
    /^трекер$/i,
    /^читает$/i,
    /^озвучка$/i,
    /^озвучивание$/i,
    /^перевод$/i,
    /^издательство$/i,
    /^издание$/i,
    /^формат$/i,
    /^битрейт$/i,
    /^длительность$/i,
    /^время$/i,
    /^часов$/i,
    /^минут$/i,
    /^секунд$/i,
    /.*:.*время.*/i,
    /.*:.*читает.*/i,
    /.*:.*озвучка.*/i,
    /.*:.*перевод.*/i,
  ];
  
  // Check if it matches any technical pattern
  if (technicalPatterns.some(pattern => pattern.test(genre))) {
    return false;
  }
  
  // Filter out strings that contain colons (likely metadata)
  if (genre.includes(':') && genre.length < 50) {
    // Allow colons in longer strings (might be legitimate genre descriptions)
    // but filter out short metadata strings with colons
    return false;
  }
  
  // Filter out strings that are mostly punctuation or symbols
  // Count letters (including Cyrillic)
  const letters = genre.match(/[a-zA-Zа-яА-ЯёЁ]/g) || [];
  const letterRatio = letters.length / genre.length;
  if (letterRatio < 0.5) return false;
  
  // Filter out very short strings after cleaning (remove non-letters, non-digits)
  const cleanGenre = genre.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');
  if (cleanGenre.length < 2) return false;
  
  // Filter out strings that are too long (likely concatenated multiple genres)
  if (cleanGenre.length > 50) return false;
  
  return true;
}
