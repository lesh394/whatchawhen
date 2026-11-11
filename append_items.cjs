const fs = require('fs');

const newItemsRaw = [
  // MUSIC (Modern & Diverse Eras)
  {
    category: 'music',
    title: 'Future Nostalgia',
    creator: 'Dua Lipa',
    year: 2020,
    wikiSlug: 'Future_Nostalgia',
    genreOrMovement: 'Nu-Disco / Pop',
    hint1: 'Features disco and funk-inspired anthems like "Don\'t Start Now" and "Levitating".',
    hint2: 'British-Albanian singer driving a retro sports car under the full moon on the cover.',
    creatorType: 'Artist',
    itemType: 'Album',
    trivia: 'Recorded over two years across London, Los Angeles, and Paris, winning Best Pop Vocal Album at the 2021 Grammys.',
    altTitles: ['Future Nostalgia'],
    altCreators: ['Dua Lipa']
  },
  {
    category: 'music',
    title: 'When We All Fall Asleep, Where Do We Go?',
    creator: 'Billie Eilish',
    year: 2019,
    wikiSlug: 'When_We_All_Fall_Asleep,_Where_Do_We_Go%3F',
    genreOrMovement: 'Electropop / Dark Pop',
    hint1: 'Cover shows the young singer sitting on a bed with completely white eyes in an ominous dark room.',
    hint2: 'Contains the global chart-topping hit "Bad Guy" recorded in a home bedroom.',
    creatorType: 'Artist',
    itemType: 'Album',
    trivia: 'She swept all four major Grammy categories (Best New Artist, Record of the Year, Song of the Year, and Album of the Year) in a single night at age 18.',
    altTitles: ['When We All Fall Asleep Where Do We Go', 'When We All Fall Asleep, Where Do We Go?'],
    altCreators: ['Billie Eilish', 'Finneas']
  },
  {
    category: 'music',
    title: 'Sour',
    creator: 'Olivia Rodrigo',
    year: 2021,
    wikiSlug: 'Sour_(album)',
    genreOrMovement: 'Pop Punk / Alt-Pop',
    hint1: 'Cover shows the singer with pastel stickers plastered all over her face and sticking her tongue out.',
    hint2: 'Features heartbreak ballads "Drivers License" and "Good 4 U".',
    creatorType: 'Artist',
    itemType: 'Album',
    trivia: 'Drivers License broke Spotify’s record for the most daily streams for a non-holiday song in music history.',
    altTitles: ['Sour', 'SOUR'],
    altCreators: ['Olivia Rodrigo']
  },
  {
    category: 'music',
    title: 'After Hours',
    creator: 'The Weeknd',
    year: 2020,
    wikiSlug: 'After_Hours_(The_Weeknd_album)',
    genreOrMovement: 'Synthwave / R&B',
    hint1: 'Cover shows the singer with a bloodied nose and bandaged face wearing an iconic red blazer.',
    hint2: 'Features "Blinding Lights", which spent a record 90 weeks on the Billboard Hot 100 chart.',
    creatorType: 'Artist',
    itemType: 'Album',
    trivia: 'Blinding Lights became the number-one song of all time on Billboard’s Greatest Songs of All Time chart.',
    altTitles: ['After Hours'],
    altCreators: ['The Weeknd', 'Abel Tesfaye']
  },
  {
    category: 'music',
    title: 'Random Access Memories',
    creator: 'Daft Punk',
    year: 2013,
    wikiSlug: 'Random_Access_Memories',
    genreOrMovement: 'Disco / Electronic / Funk',
    hint1: 'Cover features the two chrome and gold robot helmets fused together.',
    hint2: 'Includes the worldwide smash hit "Get Lucky" featuring Pharrell Williams and Nile Rodgers.',
    creatorType: 'Band',
    itemType: 'Album',
    trivia: 'The duo chose to record almost entirely using live session musicians instead of electronic software samples.',
    altTitles: ['Random Access Memories', 'RAM'],
    altCreators: ['Daft Punk']
  },
  {
    category: 'music',
    title: 'Unknown Pleasures',
    creator: 'Joy Division',
    year: 1979,
    wikiSlug: 'Unknown_Pleasures',
    genreOrMovement: 'Post-Punk',
    hint1: 'Famous cover of 100 radio frequency pulses from pulsar PSR B1919+21 on black cardboard.',
    hint2: 'Fronted by the brooding baritone vocalist Ian Curtis in Manchester.',
    creatorType: 'Band',
    itemType: 'Album',
    trivia: 'The pulsar image was found by guitarist Bernard Sumner in The Cambridge Encyclopaedia of Astronomy.',
    altTitles: ['Unknown Pleasures'],
    altCreators: ['Joy Division', 'Ian Curtis']
  },
  {
    category: 'music',
    title: 'Back in Black',
    creator: 'AC/DC',
    year: 1980,
    wikiSlug: 'Back_in_Black',
    genreOrMovement: 'Hard Rock',
    hint1: 'Sleek all-black cover designed as a sign of mourning for original frontman Bon Scott.',
    hint2: 'Features "Hells Bells", "You Shook Me All Night Long", and the blistering title track.',
    creatorType: 'Band',
    itemType: 'Album',
    trivia: 'It is the second best-selling album of all time in global history, with over 50 million copies sold.',
    altTitles: ['Back in Black'],
    altCreators: ['AC/DC', 'ACDC', 'Brian Johnson']
  },

  // BOOKS (Timeless & Modern Classics)
  {
    category: 'books',
    title: 'Don Quixote',
    creator: 'Miguel de Cervantes',
    year: 1605,
    wikiSlug: 'Don_Quixote',
    genreOrMovement: 'Satirical Chivalric Romance',
    hint1: 'Follows an aging Spanish noble who loses his sanity reading knight stories and attacks windmills.',
    hint2: 'Accompanied by his loyal squire Sancho Panza and gaunt horse Rocinante.',
    creatorType: 'Author',
    itemType: 'Novel',
    trivia: 'Often regarded by critics and authors as the very first modern European novel in literary history.',
    altTitles: ['Don Quixote', 'The Ingenious Gentleman Don Quixote of La Mancha'],
    altCreators: ['Miguel de Cervantes', 'Cervantes']
  },
  {
    category: 'books',
    title: 'War and Peace',
    creator: 'Leo Tolstoy',
    year: 1869,
    wikiSlug: 'War_and_Peace',
    genreOrMovement: 'Epic Realism / Historical Fiction',
    hint1: 'Monumental Russian epic chronicling five aristocratic families during Napoleon\'s invasion in 1812.',
    hint2: 'Features Pierre Bezukhov, Prince Andrei Bolkonsky, and Natasha Rostova.',
    creatorType: 'Author',
    itemType: 'Novel',
    trivia: 'Tolstoy wrote and revised the massive manuscript by hand more than seven full times with his wife Sophia.',
    altTitles: ['War and Peace'],
    altCreators: ['Leo Tolstoy', 'Tolstoy']
  },
  {
    category: 'books',
    title: 'The Shining',
    creator: 'Stephen King',
    year: 1977,
    wikiSlug: 'The_Shining_(novel)',
    genreOrMovement: 'Psychological Horror / Supernatural',
    hint1: 'Aspiring writer Jack Torrance becomes the winter caretaker of the haunted Overlook Hotel in Colorado.',
    hint2: 'Features telepathic abilities called "the shining" possessed by his young son Danny.',
    creatorType: 'Author',
    itemType: 'Novel',
    trivia: 'King was inspired after staying in room 217 of the empty, snowbound Stanley Hotel in Estes Park, Colorado in 1974.',
    altTitles: ['The Shining'],
    altCreators: ['Stephen King']
  },
  {
    category: 'books',
    title: 'The Hitchhiker\'s Guide to the Galaxy',
    creator: 'Douglas Adams',
    year: 1979,
    wikiSlug: 'The_Hitchhiker%27s_Guide_to_the_Galaxy_(novel)',
    genreOrMovement: 'Comedy Science Fiction',
    hint1: 'Arthur Dent is rescued into space seconds before the Earth is demolished to build an intergalactic bypass.',
    hint2: 'Contains the famous cover slogan: "DON\'T PANIC" and the answer to life: "42".',
    creatorType: 'Author',
    itemType: 'Novel',
    trivia: 'Adams conceived the premise while lying drunk in an open field in Innsbruck, Austria, staring up at the starry sky with a European hitchhiker guide.',
    altTitles: ['The Hitchhiker\'s Guide to the Galaxy', 'Hitchhiker\'s Guide'],
    altCreators: ['Douglas Adams']
  },
  {
    category: 'books',
    title: 'The Road',
    creator: 'Cormac McCarthy',
    year: 2006,
    wikiSlug: 'The_Road',
    genreOrMovement: 'Post-Apocalyptic / Tragedy',
    hint1: 'A father and young son journey across a burned, ash-covered American wasteland carrying a pistol.',
    hint2: 'Won the Pulitzer Prize for Fiction in 2007.',
    creatorType: 'Author',
    itemType: 'Novel',
    trivia: 'McCarthy dedicated the sparse, haunting novel to his young son John Francis McCarthy.',
    altTitles: ['The Road'],
    altCreators: ['Cormac McCarthy']
  },

  // ART (Monet, Impressionism, Warhol, Kahlo)
  {
    category: 'art',
    title: 'Water Lilies',
    creator: 'Claude Monet',
    year: 1916,
    wikiSlug: 'Water_Lilies_(Monet_series)',
    genreOrMovement: 'Impressionism',
    hint1: 'A series of approximately 250 oil paintings depicting his flower garden at Giverny.',
    hint2: 'Features willow reflections and white lilies floating on reflective French ponds.',
    creatorType: 'Painter',
    itemType: 'Painting',
    trivia: 'Monet worked on these monumental canvases while suffering from severe cataracts, altering his perception of light and blue tones.',
    altTitles: ['Water Lilies', 'Nymphéas', 'Nympheas'],
    altCreators: ['Claude Monet', 'Monet']
  },
  {
    category: 'art',
    title: 'Impression, Sunrise',
    creator: 'Claude Monet',
    year: 1872,
    wikiSlug: 'Impression,_Sunrise',
    genreOrMovement: 'Impressionism',
    hint1: 'Depicts the port of Le Havre at dawn with a striking luminous orange sun reflecting on the water.',
    hint2: 'A critical review of this exact painting gave birth to the name of the "Impressionist" art movement.',
    creatorType: 'Painter',
    itemType: 'Painting',
    trivia: 'Art critic Louis Leroy derisively labeled Monet’s technique as mere "impressions", giving the historic movement its name.',
    altTitles: ['Impression, Sunrise', 'Impression, soleil levant'],
    altCreators: ['Claude Monet', 'Monet']
  },
  {
    category: 'art',
    title: 'Campbell\'s Soup Cans',
    creator: 'Andy Warhol',
    year: 1962,
    wikiSlug: 'Campbell%27s_Soup_Cans',
    genreOrMovement: 'Pop Art',
    hint1: 'Thirty-two canvases of red and white commercial canned soup flavors produced via screen printing.',
    hint2: 'Explores mass production, consumerism, and advertising as fine art.',
    creatorType: 'Painter',
    itemType: 'Artwork',
    trivia: 'Warhol claimed he ate Campbell’s soup for lunch every single day for twenty years.',
    altTitles: ['Campbell\'s Soup Cans', '32 Campbell\'s Soup Cans'],
    altCreators: ['Andy Warhol', 'Warhol']
  },
  {
    category: 'art',
    title: 'The Two Fridas',
    creator: 'Frida Kahlo',
    year: 1939,
    wikiSlug: 'The_Two_Fridas',
    genreOrMovement: 'Surrealism / Magical Realism',
    hint1: 'Double self-portrait showing two versions of the artist holding hands with visible exposed hearts connected by veins.',
    hint2: 'Painted during her painful divorce from the Mexican muralist Diego Rivera.',
    creatorType: 'Painter',
    itemType: 'Painting',
    trivia: 'One Frida wears a white European Victorian wedding dress; the other wears traditional Mexican Tehuana attire.',
    altTitles: ['The Two Fridas', 'Las dos Fridas'],
    altCreators: ['Frida Kahlo', 'Kahlo']
  }
];

async function append() {
  console.log('Fetching Wikipedia data for new items...');
  const enriched = [];

  for (const item of newItemsRaw) {
    let image = '';
    let highResImage = '';
    let wikiExtract = '';

    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${item.wikiSlug}`, {
        headers: { 'User-Agent': 'WhatchaWhenGame/2.0 (edu@whatchawhen.app)' }
      });
      if (res.ok) {
        const d = await res.json();
        image = d.thumbnail?.source || '';
        highResImage = d.originalimage?.source || image;
        wikiExtract = d.extract || '';
      }
    } catch(e) {}

    const id = `${item.category}-${Date.now().toString(36)}-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    enriched.push({
      id,
      category: item.category,
      title: item.title,
      creator: item.creator,
      year: item.year,
      wikiSlug: item.wikiSlug,
      image,
      highResImage,
      genreOrMovement: item.genreOrMovement,
      hint1: item.hint1,
      hint2: item.hint2,
      creatorType: item.creatorType,
      itemType: item.itemType,
      trivia: item.trivia,
      altTitles: item.altTitles,
      altCreators: item.altCreators,
      wikiExtract
    });
    console.log(item.title, '->', image ? 'OK' : 'NO IMG');
    await new Promise(r => setTimeout(r, 100));
  }

  // Read existing items
  const currentContent = fs.readFileSync('./src/data/items.ts', 'utf8');
  const closingIndex = currentContent.lastIndexOf('];');

  if (closingIndex !== -1) {
    const jsonToAppend = enriched.map(e => JSON.stringify(e, null, 2)).join(',\n  ');
    const updatedContent = currentContent.slice(0, closingIndex) + ',\n  ' + jsonToAppend + '\n];\n';
    fs.writeFileSync('./src/data/items.ts', updatedContent, 'utf8');
    console.log('Successfully appended items to src/data/items.ts!');
  }
}

append();
