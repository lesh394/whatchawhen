import { CulturalItem, EasyRoundOptions } from '../types';
import { createSeededRng, seededShuffle } from './multiplayer';

// Large diverse distractor pool to prevent recycled options in Easy Mode
export const MUSIC_DISTRACTORS = [
  // 2020s & 2010s
  { title: 'Sour', creator: 'Olivia Rodrigo' },
  { title: 'Guts', creator: 'Olivia Rodrigo' },
  { title: 'When We All Fall Asleep, Where Do We Go?', creator: 'Billie Eilish' },
  { title: 'Happier Than Ever', creator: 'Billie Eilish' },
  { title: 'Future Nostalgia', creator: 'Dua Lipa' },
  { title: 'After Hours', creator: 'The Weeknd' },
  { title: 'Dawn FM', creator: 'The Weeknd' },
  { title: 'SOS', creator: 'SZA' },
  { title: 'Midnights', creator: 'Taylor Swift' },
  { title: 'Folklore', creator: 'Taylor Swift' },
  { title: '1989', creator: 'Taylor Swift' },
  { title: 'Renaissance', creator: 'Beyoncé' },
  { title: 'Lemonade', creator: 'Beyoncé' },
  { title: 'Un Verano Sin Ti', creator: 'Bad Bunny' },
  { title: 'Harry’s House', creator: 'Harry Styles' },
  { title: 'Fine Line', creator: 'Harry Styles' },
  { title: 'Melodrama', creator: 'Lorde' },
  { title: 'Pure Heroine', creator: 'Lorde' },
  { title: 'Currents', creator: 'Tame Impala' },
  { title: 'Random Access Memories', creator: 'Daft Punk' },
  { title: 'Blonde', creator: 'Frank Ocean' },
  { title: 'Channel Orange', creator: 'Frank Ocean' },
  { title: 'To Pimp a Butterfly', creator: 'Kendrick Lamar' },
  { title: 'DAMN.', creator: 'Kendrick Lamar' },
  { title: 'good kid, m.A.A.d city', creator: 'Kendrick Lamar' },
  { title: '21', creator: 'Adele' },
  { title: '25', creator: 'Adele' },
  { title: '30', creator: 'Adele' },
  { title: 'My Beautiful Dark Twisted Fantasy', creator: 'Kanye West' },
  { title: 'Graduation', creator: 'Kanye West' },
  { title: 'Born to Die', creator: 'Lana Del Rey' },
  { title: 'Norman Fucking Rockwell!', creator: 'Lana Del Rey' },
  { title: 'AM', creator: 'Arctic Monkeys' },
  { title: 'The Fame', creator: 'Lady Gaga' },
  { title: 'IGOR', creator: 'Tyler, the Creator' },
  { title: 'Golden Hour', creator: 'Kacey Musgraves' },
  { title: 'Punisher', creator: 'Phoebe Bridgers' },
  // 1990s & 2000s
  { title: 'Back to Black', creator: 'Amy Winehouse' },
  { title: 'Is This It', creator: 'The Strokes' },
  { title: 'Room on Fire', creator: 'The Strokes' },
  { title: 'Demon Days', creator: 'Gorillaz' },
  { title: 'Gorillaz', creator: 'Gorillaz' },
  { title: 'Elephant', creator: 'The White Stripes' },
  { title: 'White Blood Cells', creator: 'The White Stripes' },
  { title: 'Discovery', creator: 'Daft Punk' },
  { title: 'Homework', creator: 'Daft Punk' },
  { title: 'OK Computer', creator: 'Radiohead' },
  { title: 'Kid A', creator: 'Radiohead' },
  { title: 'The Bends', creator: 'Radiohead' },
  { title: 'Nevermind', creator: 'Nirvana' },
  { title: 'In Utero', creator: 'Nirvana' },
  { title: 'The Miseducation of Lauryn Hill', creator: 'Lauryn Hill' },
  { title: '(What’s the Story) Morning Glory?', creator: 'Oasis' },
  { title: 'Definitely Maybe', creator: 'Oasis' },
  { title: 'Homogenic', creator: 'Björk' },
  { title: 'Post', creator: 'Björk' },
  { title: 'Dookie', creator: 'Green Day' },
  { title: 'American Idiot', creator: 'Green Day' },
  { title: 'Automatic for the People', creator: 'R.E.M.' },
  { title: 'The Low End Theory', creator: 'A Tribe Called Quest' },
  { title: 'The Marshall Mathers LP', creator: 'Eminem' },
  { title: 'A Rush of Blood to the Head', creator: 'Coldplay' },
  { title: 'Parachutes', creator: 'Coldplay' },
  { title: 'Grace', creator: 'Jeff Buckley' },
  { title: 'Californication', creator: 'Red Hot Chili Peppers' },
  { title: 'The Slim Shady LP', creator: 'Eminem' },
  // 1970s & 1980s
  { title: 'Thriller', creator: 'Michael Jackson' },
  { title: 'Bad', creator: 'Michael Jackson' },
  { title: 'Off the Wall', creator: 'Michael Jackson' },
  { title: 'Purple Rain', creator: 'Prince' },
  { title: 'Sign o’ the Times', creator: 'Prince' },
  { title: 'Back in Black', creator: 'AC/DC' },
  { title: 'Highway to Hell', creator: 'AC/DC' },
  { title: 'Master of Puppets', creator: 'Metallica' },
  { title: 'Ride the Lightning', creator: 'Metallica' },
  { title: 'The Joshua Tree', creator: 'U2' },
  { title: 'War', creator: 'U2' },
  { title: 'The Dark Side of the Moon', creator: 'Pink Floyd' },
  { title: 'Wish You Were Here', creator: 'Pink Floyd' },
  { title: 'The Wall', creator: 'Pink Floyd' },
  { title: 'Rumours', creator: 'Fleetwood Mac' },
  { title: 'Fleetwood Mac', creator: 'Fleetwood Mac' },
  { title: 'A Night at the Opera', creator: 'Queen' },
  { title: 'News of the World', creator: 'Queen' },
  { title: 'Songs in the Key of Life', creator: 'Stevie Wonder' },
  { title: 'Innervisions', creator: 'Stevie Wonder' },
  { title: 'Led Zeppelin IV', creator: 'Led Zeppelin' },
  { title: 'Physical Graffiti', creator: 'Led Zeppelin' },
  { title: 'London Calling', creator: 'The Clash' },
  { title: 'Unknown Pleasures', creator: 'Joy Division' },
  { title: 'Closer', creator: 'Joy Division' },
  { title: 'Remain in Light', creator: 'Talking Heads' },
  { title: 'Exile on Main St.', creator: 'The Rolling Stones' },
  { title: 'Sticky Fingers', creator: 'The Rolling Stones' },
  { title: 'The Rise and Fall of Ziggy Stardust', creator: 'David Bowie' },
  { title: 'Heroes', creator: 'David Bowie' },
  { title: 'Hunky Dory', creator: 'David Bowie' },
  { title: 'Blue', creator: 'Joni Mitchell' },
  { title: 'Court and Spark', creator: 'Joni Mitchell' },
  { title: 'Horses', creator: 'Patti Smith' },
  { title: 'Exodus', creator: 'Bob Marley' },
  { title: 'Legend', creator: 'Bob Marley' },
  { title: 'Like a Prayer', creator: 'Madonna' },
  { title: 'Appetite for Destruction', creator: 'Guns N’ Roses' },
  { title: 'The Queen Is Dead', creator: 'The Smiths' },
  { title: 'Disintegration', creator: 'The Cure' },
  { title: 'Hounds of Love', creator: 'Kate Bush' },
  { title: 'Paranoid', creator: 'Black Sabbath' },
  { title: 'Tapestry', creator: 'Carole King' },
  { title: 'What’s Going On', creator: 'Marvin Gaye' },
  // 1950s & 1960s
  { title: 'Abbey Road', creator: 'The Beatles' },
  { title: 'Sgt. Pepper’s Lonely Hearts Club Band', creator: 'The Beatles' },
  { title: 'Revolver', creator: 'The Beatles' },
  { title: 'Rubber Soul', creator: 'The Beatles' },
  { title: 'Pet Sounds', creator: 'The Beach Boys' },
  { title: 'Highway 61 Revisited', creator: 'Bob Dylan' },
  { title: 'Blonde on Blonde', creator: 'Bob Dylan' },
  { title: 'Kind of Blue', creator: 'Miles Davis' },
  { title: 'At Folsom Prison', creator: 'Johnny Cash' },
  { title: 'Are You Experienced', creator: 'The Jimi Hendrix Experience' },
  { title: 'Axis: Bold as Love', creator: 'The Jimi Hendrix Experience' },
  { title: 'The Velvet Underground & Nico', creator: 'The Velvet Underground' },
  { title: 'White Light/White Heat', creator: 'The Velvet Underground' },
  { title: 'After School Session', creator: 'Chuck Berry' },
  { title: 'Elvis Presley', creator: 'Elvis Presley' },
  { title: 'I Never Loved a Man the Way I Love You', creator: 'Aretha Franklin' },
  { title: 'Lady Soul', creator: 'Aretha Franklin' },
  { title: 'Bridge over Troubled Water', creator: 'Simon & Garfunkel' },
  { title: 'The Doors', creator: 'The Doors' },
];

export const BOOKS_DISTRACTORS = [
  // Contemporary & 21st Century
  { title: 'The Road', creator: 'Cormac McCarthy' },
  { title: 'No Country for Old Men', creator: 'Cormac McCarthy' },
  { title: 'Blood Meridian', creator: 'Cormac McCarthy' },
  { title: 'The Hunger Games', creator: 'Suzanne Collins' },
  { title: 'Catching Fire', creator: 'Suzanne Collins' },
  { title: 'Normal People', creator: 'Sally Rooney' },
  { title: 'Conversations with Friends', creator: 'Sally Rooney' },
  { title: 'The Da Vinci Code', creator: 'Dan Brown' },
  { title: 'Angels & Demons', creator: 'Dan Brown' },
  { title: 'Harry Potter and the Philosopher’s Stone', creator: 'J. K. Rowling' },
  { title: 'Harry Potter and the Prisoner of Azkaban', creator: 'J. K. Rowling' },
  { title: 'Norwegian Wood', creator: 'Haruki Murakami' },
  { title: 'Kafka on the Shore', creator: 'Haruki Murakami' },
  { title: 'The Kite Runner', creator: 'Khaled Hosseini' },
  { title: 'A Thousand Splendid Suns', creator: 'Khaled Hosseini' },
  { title: 'Never Let Me Go', creator: 'Kazuo Ishiguro' },
  { title: 'The Remains of the Day', creator: 'Kazuo Ishiguro' },
  { title: 'Atonement', creator: 'Ian McEwan' },
  { title: 'Life of Pi', creator: 'Yann Martel' },
  { title: 'The Shining', creator: 'Stephen King' },
  { title: 'It', creator: 'Stephen King' },
  { title: 'Misery', creator: 'Stephen King' },
  { title: 'The Stand', creator: 'Stephen King' },
  { title: 'The Hitchhiker’s Guide to the Galaxy', creator: 'Douglas Adams' },
  { title: 'The Handmaid’s Tale', creator: 'Margaret Atwood' },
  { title: 'Oryx and Crake', creator: 'Margaret Atwood' },
  { title: 'Neuromancer', creator: 'William Gibson' },
  { title: 'Gone Girl', creator: 'Gillian Flynn' },
  { title: 'Where the Crawdads Sing', creator: 'Delia Owens' },
  { title: 'The Alchemist', creator: 'Paulo Coelho' },
  { title: 'Blindness', creator: 'José Saramago' },
  { title: 'A Game of Thrones', creator: 'George R. R. Martin' },
  { title: 'A Clash of Kings', creator: 'George R. R. Martin' },
  { title: 'The Fault in Our Stars', creator: 'John Green' },
  { title: 'Midnight’s Children', creator: 'Salman Rushdie' },
  { title: 'The Color Purple', creator: 'Alice Walker' },
  { title: 'The God of Small Things', creator: 'Arundhati Roy' },
  { title: 'White Teeth', creator: 'Zadie Smith' },
  { title: 'Infinite Jest', creator: 'David Foster Wallace' },
  // 20th Century Classics
  { title: 'One Hundred Years of Solitude', creator: 'Gabriel García Márquez' },
  { title: 'Love in the Time of Cholera', creator: 'Gabriel García Márquez' },
  { title: 'To Kill a Mockingbird', creator: 'Harper Lee' },
  { title: 'Nineteen Eighty-Four', creator: 'George Orwell' },
  { title: 'Animal Farm', creator: 'George Orwell' },
  { title: 'The Great Gatsby', creator: 'F. Scott Fitzgerald' },
  { title: 'Tender Is the Night', creator: 'F. Scott Fitzgerald' },
  { title: 'The Catcher in the Rye', creator: 'J. D. Salinger' },
  { title: 'Franny and Zooey', creator: 'J. D. Salinger' },
  { title: 'Brave New World', creator: 'Aldous Huxley' },
  { title: 'The Hobbit', creator: 'J. R. R. Tolkien' },
  { title: 'The Lord of the Rings', creator: 'J. R. R. Tolkien' },
  { title: 'The Silmarillion', creator: 'J. R. R. Tolkien' },
  { title: 'Fahrenheit 451', creator: 'Ray Bradbury' },
  { title: 'The Martian Chronicles', creator: 'Ray Bradbury' },
  { title: 'Lord of the Flies', creator: 'William Golding' },
  { title: 'The Stranger', creator: 'Albert Camus' },
  { title: 'The Plague', creator: 'Albert Camus' },
  { title: 'The Metamorphosis', creator: 'Franz Kafka' },
  { title: 'The Trial', creator: 'Franz Kafka' },
  { title: 'The Castle', creator: 'Franz Kafka' },
  { title: 'The Old Man and the Sea', creator: 'Ernest Hemingway' },
  { title: 'For Whom the Bell Tolls', creator: 'Ernest Hemingway' },
  { title: 'A Farewell to Arms', creator: 'Ernest Hemingway' },
  { title: 'The Sun Also Rises', creator: 'Ernest Hemingway' },
  { title: 'Beloved', creator: 'Toni Morrison' },
  { title: 'Song of Solomon', creator: 'Toni Morrison' },
  { title: 'Slaughterhouse-Five', creator: 'Kurt Vonnegut' },
  { title: 'Cat’s Cradle', creator: 'Kurt Vonnegut' },
  { title: 'Things Fall Apart', creator: 'Chinua Achebe' },
  { title: 'Invisible Man', creator: 'Ralph Ellison' },
  { title: 'Ulysses', creator: 'James Joyce' },
  { title: 'Dubliners', creator: 'James Joyce' },
  { title: 'A Portrait of the Artist as a Young Man', creator: 'James Joyce' },
  { title: 'Mrs Dalloway', creator: 'Virginia Woolf' },
  { title: 'To the Lighthouse', creator: 'Virginia Woolf' },
  { title: 'Orlando', creator: 'Virginia Woolf' },
  { title: 'The Sound and the Fury', creator: 'William Faulkner' },
  { title: 'As I Lay Dying', creator: 'William Faulkner' },
  { title: 'The Grapes of Wrath', creator: 'John Steinbeck' },
  { title: 'East of Eden', creator: 'John Steinbeck' },
  { title: 'Of Mice and Men', creator: 'John Steinbeck' },
  { title: 'On the Road', creator: 'Jack Kerouac' },
  { title: 'Dune', creator: 'Frank Herbert' },
  { title: 'The Little Prince', creator: 'Antoine de Saint-Exupéry' },
  // 19th Century & Ancient Epics
  { title: 'Frankenstein', creator: 'Mary Shelley' },
  { title: 'Pride and Prejudice', creator: 'Jane Austen' },
  { title: 'Sense and Sensibility', creator: 'Jane Austen' },
  { title: 'Emma', creator: 'Jane Austen' },
  { title: 'Persuasion', creator: 'Jane Austen' },
  { title: 'Moby-Dick', creator: 'Herman Melville' },
  { title: 'Jane Eyre', creator: 'Charlotte Brontë' },
  { title: 'Wuthering Heights', creator: 'Emily Brontë' },
  { title: 'A Tale of Two Cities', creator: 'Charles Dickens' },
  { title: 'Great Expectations', creator: 'Charles Dickens' },
  { title: 'Oliver Twist', creator: 'Charles Dickens' },
  { title: 'David Copperfield', creator: 'Charles Dickens' },
  { title: 'Crime and Punishment', creator: 'Fyodor Dostoevsky' },
  { title: 'The Brothers Karamazov', creator: 'Fyodor Dostoevsky' },
  { title: 'The Idiot', creator: 'Fyodor Dostoevsky' },
  { title: 'War and Peace', creator: 'Leo Tolstoy' },
  { title: 'Anna Karenina', creator: 'Leo Tolstoy' },
  { title: 'Dracula', creator: 'Bram Stoker' },
  { title: 'The Picture of Dorian Gray', creator: 'Oscar Wilde' },
  { title: 'Les Misérables', creator: 'Victor Hugo' },
  { title: 'The Hunchback of Notre-Dame', creator: 'Victor Hugo' },
  { title: 'Madame Bovary', creator: 'Gustave Flaubert' },
  { title: 'The Count of Monte Cristo', creator: 'Alexandre Dumas' },
  { title: 'The Three Musketeers', creator: 'Alexandre Dumas' },
  { title: 'Don Quixote', creator: 'Miguel de Cervantes' },
  { title: 'The Divine Comedy', creator: 'Dante Alighieri' },
  { title: 'The Odyssey', creator: 'Homer' },
  { title: 'The Iliad', creator: 'Homer' },
  { title: 'Hamlet', creator: 'William Shakespeare' },
  { title: 'Macbeth', creator: 'William Shakespeare' },
];

export const ART_DISTRACTORS = [
  // Modern & Contemporary
  { title: 'Campbell’s Soup Cans', creator: 'Andy Warhol' },
  { title: 'Marilyn Diptych', creator: 'Andy Warhol' },
  { title: 'The Two Fridas', creator: 'Frida Kahlo' },
  { title: 'The Broken Column', creator: 'Frida Kahlo' },
  { title: 'Self-Portrait with Thorn Necklace', creator: 'Frida Kahlo' },
  { title: 'The Son of Man', creator: 'René Magritte' },
  { title: 'The Treachery of Images', creator: 'René Magritte' },
  { title: 'Nighthawks', creator: 'Edward Hopper' },
  { title: 'Automat', creator: 'Edward Hopper' },
  { title: 'Guernica', creator: 'Pablo Picasso' },
  { title: 'Les Demoiselles d’Avignon', creator: 'Pablo Picasso' },
  { title: 'The Weeping Woman', creator: 'Pablo Picasso' },
  { title: 'The Old Guitarist', creator: 'Pablo Picasso' },
  { title: 'American Gothic', creator: 'Grant Wood' },
  { title: 'The Persistence of Memory', creator: 'Salvador Dalí' },
  { title: 'Swans Reflecting Elephants', creator: 'Salvador Dalí' },
  { title: 'Girl with Balloon', creator: 'Banksy' },
  { title: 'Love is in the Bin', creator: 'Banksy' },
  { title: 'Untitled (Skull)', creator: 'Jean-Michel Basquiat' },
  { title: 'Untitled (Boxer)', creator: 'Jean-Michel Basquiat' },
  { title: 'Radiant Baby', creator: 'Keith Haring' },
  { title: 'Crack is Wack', creator: 'Keith Haring' },
  { title: 'Infinity Mirrored Room', creator: 'Yayoi Kusama' },
  { title: 'A Bigger Splash', creator: 'David Hockney' },
  { title: 'Portrait of an Artist (Pool with Two Figures)', creator: 'David Hockney' },
  { title: 'No. 5, 1948', creator: 'Jackson Pollock' },
  { title: 'Autumn Rhythm (Number 30)', creator: 'Jackson Pollock' },
  { title: 'Orange, Red, Yellow', creator: 'Mark Rothko' },
  { title: 'No. 61 (Rust and Blue)', creator: 'Mark Rothko' },
  { title: 'Whaam!', creator: 'Roy Lichtenstein' },
  { title: 'Drowning Girl', creator: 'Roy Lichtenstein' },
  // Impressionism & Expressionism
  { title: 'The Starry Night', creator: 'Vincent van Gogh' },
  { title: 'Sunflowers', creator: 'Vincent van Gogh' },
  { title: 'Cafe Terrace at Night', creator: 'Vincent van Gogh' },
  { title: 'Bedroom in Arles', creator: 'Vincent van Gogh' },
  { title: 'Wheatfield with Crows', creator: 'Vincent van Gogh' },
  { title: 'The Scream', creator: 'Edvard Munch' },
  { title: 'Madonna', creator: 'Edvard Munch' },
  { title: 'The Kiss', creator: 'Gustav Klimt' },
  { title: 'Portrait of Adele Bloch-Bauer I', creator: 'Gustav Klimt' },
  { title: 'Water Lilies', creator: 'Claude Monet' },
  { title: 'Impression, Sunrise', creator: 'Claude Monet' },
  { title: 'Woman with a Parasol', creator: 'Claude Monet' },
  { title: 'A Sunday on La Grande Jatte', creator: 'Georges Seurat' },
  { title: 'A Bar at the Folies-Bergère', creator: 'Édouard Manet' },
  { title: 'Le Déjeuner sur l’herbe', creator: 'Édouard Manet' },
  { title: 'The Great Wave off Kanagawa', creator: 'Hokusai' },
  { title: 'Fine Wind, Clear Morning', creator: 'Hokusai' },
  { title: 'Wanderer above the Sea of Fog', creator: 'Caspar David Friedrich' },
  { title: 'The Abbey in the Oakwood', creator: 'Caspar David Friedrich' },
  { title: 'Liberty Leading the People', creator: 'Eugène Delacroix' },
  { title: 'The Raft of the Medusa', creator: 'Théodore Géricault' },
  { title: 'The Third of May 1808', creator: 'Francisco Goya' },
  { title: 'Saturn Devouring His Son', creator: 'Francisco Goya' },
  { title: 'The Gleaners', creator: 'Jean-François Millet' },
  { title: 'Bal du moulin de la Galette', creator: 'Pierre-Auguste Renoir' },
  { title: 'Luncheon of the Boating Party', creator: 'Pierre-Auguste Renoir' },
  { title: 'The Dance Class', creator: 'Edgar Degas' },
  { title: 'The Card Players', creator: 'Paul Cézanne' },
  { title: 'Mont Sainte-Victoire', creator: 'Paul Cézanne' },
  // Renaissance & Baroque
  { title: 'Mona Lisa', creator: 'Leonardo da Vinci' },
  { title: 'The Last Supper', creator: 'Leonardo da Vinci' },
  { title: 'Lady with an Ermine', creator: 'Leonardo da Vinci' },
  { title: 'The Creation of Adam', creator: 'Michelangelo' },
  { title: 'The Last Judgment', creator: 'Michelangelo' },
  { title: 'The Birth of Venus', creator: 'Sandro Botticelli' },
  { title: 'Primavera', creator: 'Sandro Botticelli' },
  { title: 'Girl with a Pearl Earring', creator: 'Johannes Vermeer' },
  { title: 'The Milkmaid', creator: 'Johannes Vermeer' },
  { title: 'The Art of Painting', creator: 'Johannes Vermeer' },
  { title: 'The Night Watch', creator: 'Rembrandt' },
  { title: 'Self-Portrait with Two Circles', creator: 'Rembrandt' },
  { title: 'Las Meninas', creator: 'Diego Velázquez' },
  { title: 'The School of Athens', creator: 'Raphael' },
  { title: 'The Sistine Madonna', creator: 'Raphael' },
  { title: 'The Tower of Babel', creator: 'Pieter Bruegel' },
  { title: 'Hunters in the Snow', creator: 'Pieter Bruegel' },
  { title: 'The Arnolfini Portrait', creator: 'Jan van Eyck' },
  { title: 'Ghent Altarpiece', creator: 'Jan van Eyck' },
  { title: 'The Garden of Earthly Delights', creator: 'Hieronymus Bosch' },
  { title: 'The Calling of Saint Matthew', creator: 'Caravaggio' },
  { title: 'Judith Beheading Holofernes', creator: 'Caravaggio' },
];

export interface EasyDistractorSource {
  category?: CulturalItem['category'];
  title: string;
  creator: string;
  id?: string;
}

/**
 * Generates varied 4 multiple-choice options for Easy mode.
 * Draws distractors from the live random pool first, only falling back to static/stored
 * distractors if fewer than 3 live items are available.
 * When `deterministicSeed` is supplied (Multiplayer mode), canonical sorting + Mulberry32
 * produces the exact same year choices, distractors, and button order across every player.
 */
export function generateEasyOptions(
  targetItem: CulturalItem,
  livePoolItems: readonly EasyDistractorSource[],
  deterministicSeed?: string,
  fallbackCatalogItems: readonly CulturalItem[] = []
): EasyRoundOptions {
  const rng = deterministicSeed ? createSeededRng(deterministicSeed) : Math.random;

  // 1. Dynamic Year Generation with randomized offset combinations
  const yearsSet = new Set<number>();
  yearsSet.add(targetItem.year);

  const offsetCombos = [
    [-14, -6, +8],
    [-9, +5, +16],
    [-22, -8, +12],
    [-15, +7, +21],
    [-7, +9, +18],
    [-11, -3, +14],
    [-18, +6, +15],
    [-12, +11, +25],
  ];

  const chosenCombo = offsetCombos[Math.floor(rng() * offsetCombos.length)];
  const jitter = () => Math.floor(rng() * 5) - 2; // -2 to +2 jitter

  for (const off of chosenCombo) {
    const candidate = targetItem.year + off + jitter();
    if (candidate >= 1400 && candidate <= 2026 && !yearsSet.has(candidate)) {
      yearsSet.add(candidate);
    }
  }

  // Fallback random years if collisions occurred
  while (yearsSet.size < 4) {
    const randomYear = targetItem.category === 'music'
      ? Math.floor(rng() * 68) + 1956
      : targetItem.category === 'books'
      ? Math.floor(rng() * 320) + 1700
      : Math.floor(rng() * 520) + 1450;

    if (!yearsSet.has(randomYear)) {
      yearsSet.add(randomYear);
    }
  }

  const years = Array.from(yearsSet).sort((a, b) => a - b);

  // 2. Identification Choices: Live Random Pool FIRST, stored fallback ONLY if < 3 available
  const targetTitleLower = targetItem.title.trim().toLowerCase();
  const targetCreatorLower = targetItem.creator.trim().toLowerCase();

  const isSameWorkTitle = (title: string) =>
    (title || '').trim().toLowerCase() === targetTitleLower;

  const isEligibleDistractor = (
    d: { title: string; creator: string; category?: CulturalItem['category']; id?: string },
    allowSameCreator: boolean = false
  ) => {
    if (d.category && d.category !== targetItem.category) return false;
    if (d.id && d.id === targetItem.id) return false;
    const tLower = (d.title || '').trim().toLowerCase();
    const cLower = (d.creator || '').trim().toLowerCase();
    if (!tLower || !cLower) return false;
    if (isSameWorkTitle(tLower)) return false;
    if (!allowSameCreator && cLower === targetCreatorLower) return false;
    return true;
  };

  const collectPool = (
    items: readonly EasyDistractorSource[],
    allowSameCreator: boolean
  ) => {
    const map = new Map<string, { title: string; creator: string }>();
    for (const entry of items || []) {
      if (!isEligibleDistractor(entry, allowSameCreator)) continue;
      const key = `${entry.title.trim().toLowerCase()}--${entry.creator.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { title: entry.title.trim(), creator: entry.creator.trim() });
      }
    }
    const list = Array.from(map.values());
    if (deterministicSeed) {
      list.sort((a, b) => `${a.title}--${a.creator}`.localeCompare(`${b.title}--${b.creator}`));
    }
    return list;
  };

  const chosenDistractors: { title: string; creator: string }[] = [];
  const seenKeys = new Set<string>();

  const pickFrom = (list: { title: string; creator: string }[]) => {
    for (const d of seededShuffle(list, rng)) {
      const key = `${d.title.toLowerCase()}--${d.creator.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        chosenDistractors.push(d);
        if (chosenDistractors.length >= 3) break;
      }
    }
  };

  // Tier 1: Live pool items with distinct work + distinct creator
  pickFrom(collectPool(livePoolItems, false));

  // Tier 2: Live pool items with distinct work (handles single-artist categories like Monet/Van Gogh)
  if (chosenDistractors.length < 3) {
    pickFrom(collectPool(livePoolItems, true));
  }

  // Tier 3: Offline fallback only if the live random pool yielded fewer than 3 distractors
  if (chosenDistractors.length < 3) {
    const staticFallbackPool = targetItem.category === 'music'
      ? MUSIC_DISTRACTORS
      : targetItem.category === 'books'
      ? BOOKS_DISTRACTORS
      : ART_DISTRACTORS;

    const storedCatalog = (fallbackCatalogItems || [])
      .filter(it => it.category === targetItem.category && it.id !== targetItem.id)
      .map(it => ({ title: it.title, creator: it.creator, category: it.category }));

    pickFrom(collectPool([...storedCatalog, ...staticFallbackPool.map(s => ({ ...s, category: targetItem.category }))], false));
  }

  const rawIdentifications = [
    {
      title: targetItem.title,
      creator: targetItem.creator,
      label: `${targetItem.title} - ${targetItem.creator}`,
      isCorrect: true,
    },
    ...chosenDistractors.map(d => ({
      title: d.title,
      creator: d.creator,
      label: `${d.title} - ${d.creator}`,
      isCorrect: false,
    })),
  ];

  const identifications = seededShuffle(rawIdentifications, rng);

  return {
    years,
    identifications,
  };
}

const GENERIC_GENRE_PATTERNS =
  /^(?:studio album|album|debut album|debut studio album|live album|compilation album|soundtrack album|single|song|track|ep|novel|debut novel|book|short story|poem|play|painting|oil painting|oil on canvas painting|fresco|mural|artwork|work|masterwork|literature|album \/ hit|album \/ track)$/i;

const WIKI_BOILERPLATE_CLUE_PATTERNS =
  /^(?:(?:a|an|the)\s+)?(?:\d+(?:st|nd|rd|th)\s+)?(?:studio album|debut album|live album|album|single|song|ep|novel|debut novel|book|painting|oil on canvas painting|oil painting|fresco|work)\b/i;

export function getBroadEraLabel(year: number): string {
  if (year < 1500) return 'Late Medieval / Early Renaissance';
  if (year < 1600) return '16th-Century Era';
  if (year < 1700) return '17th-Century Era';
  if (year < 1800) return '18th-Century Era';
  if (year < 1835) return 'Early 19th Century';
  if (year < 1870) return 'Mid-19th Century';
  if (year < 1900) return 'Late 19th Century';
  if (year < 1935) return 'Early 20th Century';
  if (year < 1970) return 'Mid-20th Century';
  if (year < 2000) return 'Late 20th Century';
  if (year < 2010) return 'Early 21st Century';
  return 'Modern 21st Century';
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripYearSpoilers(text: string, targetYear?: number): string {
  if (!text) return '';

  const months =
    '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
  const yearToken = '(?:1[4-9]\\d{2}|20[0-2]\\d)s?';
  const singleDate = `(?:${months}(?:\\s+\\d{1,2})?|\\d{1,2}\\s+${months})`;
  const multiDate = `(?:${singleDate}(?:(?:,\\s*|\\s+(?:and|to)\\s+|\\s*[-–—]\\s*)${singleDate})*)`;
  const optionalMultiDatePrefix = `(?:${multiDate},?\\s+)?`;

  let cleaned = text
    // Parenthetical years/dates like (1981), (c. 1889), (May 1967), (15 September 2023), (1981–1982)
    .replace(
      new RegExp(
        `\\(\\s*(?:c\\.|circa|ca\\.|published|released|painted|recorded|written|completed)?\\s*${optionalMultiDatePrefix}${yearToken}(?:\\s*[-–—]\\s*${optionalMultiDatePrefix}${yearToken})?\\s*\\)`,
        'gi'
      ),
      ''
    )
    // Action + preposition + date/year clauses
    .replace(
      new RegExp(
        `(?:,\\s*)?\\b(?:released|published|painted|completed|recorded|written|composed|debuted|issued|created)\\s+(?:on|in|around|circa|ca\\.)\\s+(?:the\\s+)?(?:(?:early|mid|late)\\s+)?${optionalMultiDatePrefix}${yearToken}\\b`,
        'gi'
      ),
      ''
    )
    // Preposition + optional month/day + year
    .replace(
      new RegExp(
        `\\b(?:in|from|on|of|around|circa|ca\\.|since|during|after|before|until)\\s+(?:the\\s+(?:year\\s+)?)?${optionalMultiDatePrefix}${yearToken}\\b`,
        'gi'
      ),
      ''
    )
    // Bare date + calendar year (1400-2029)
    .replace(new RegExp(`(?:${optionalMultiDatePrefix})?\\b${yearToken}\\b`, 'gi'), '');

  if (targetYear && Number.isFinite(targetYear)) {
    cleaned = cleaned.replace(new RegExp(`\\b${targetYear}s?\\b`, 'g'), '');
  }

  return cleaned
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/,\s*and\s+(released|published|painted|completed|recorded|written|issued)\b/gi, ', $1')
    .replace(/,\s*\./g, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/^\s*[,.;:\-–—]+\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const CREATOR_ROLE_NOUN_GROUP =
  '(?:[a-z]{3,}(?:ist|er|ian)|author|painter|writer|singer|composer|producer|novelist|poet|band|group|duo|trio|collective|orchestra|ensemble)';

function redactWorkIdentifiers(
  text: string,
  item: Pick<Partial<CulturalItem>, 'title' | 'creator' | 'altTitles' | 'altCreators'>
): string {
  let out = text;

  const expandedTitles = [item.title, ...(item.altTitles || [])]
    .filter((t): t is string => Boolean(t && t.trim().length > 2))
    .flatMap(t => {
      const strippedParens = t.replace(/\s*\([^)]+\)\s*$/, '').trim();
      return strippedParens && strippedParens.length > 2 && strippedParens !== t.trim()
        ? [t.trim(), strippedParens]
        : [t.trim()];
    });

  const titles = Array.from(new Set(expandedTitles)).sort((a, b) => b.length - a.length);

  for (const title of titles) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(title)}\\b`, 'gi'), 'this work');
  }

  const creators = [item.creator, ...(item.altCreators || [])]
    .filter(
      (c): c is string =>
        Boolean(
          c &&
            c.trim().length > 2 &&
            !/^(?:acclaimed|famous|master)/i.test(c.trim())
        )
    )
    .sort((a, b) => b.length - a.length);

  for (const creator of creators) {
    const escapedCreator = escapeRegExp(creator.trim());
    out = out.replace(
      new RegExp(`\\b(${CREATOR_ROLE_NOUN_GROUP})\\s+${escapedCreator}\\b`, 'gi'),
      '$1'
    );
    out = out.replace(new RegExp(`\\bby\\s+(?:the\\s+)?${escapedCreator}\\b`, 'gi'), '');
    out = out.replace(new RegExp(`\\b${escapedCreator}\\b`, 'gi'), 'the creator');
  }

  return out
    .replace(
      new RegExp(`\\bby\\s+([a-z][a-z\\s-]{1,35}\\b${CREATOR_ROLE_NOUN_GROUP})\\b`, 'gi'),
      'by a $1'
    )
    .replace(/\bby\s+a\s+(?:the|a|an)\s+/gi, 'by a ')
    .replace(/\bby\s+a\s+([aeiou])/gi, 'by an $1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeWikiGenre(
  rawDescription: string | undefined,
  category: 'music' | 'books' | 'art',
  targetYear?: number
): string {
  const fallback =
    category === 'music' ? 'Album / Track' : category === 'books' ? 'Literature' : 'Art Masterwork';
  if (!rawDescription) return fallback;

  let cleaned = stripYearSpoilers(rawDescription, targetYear)
    .replace(/\bby\s+.+$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3 || GENERIC_GENRE_PATTERNS.test(cleaned)) {
    return fallback;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isThinClueText(
  cleanedText: string,
  item: Pick<Partial<CulturalItem>, 'title' | 'creator'>
): boolean {
  if (!cleanedText || cleanedText.length < 24) return true;
  if (/^famous\s+(?:music|books|art)\s+piece\.?$/i.test(cleanedText)) return true;

  let withoutCreator = cleanedText;
  if (item.creator && item.creator.trim().length > 2) {
    withoutCreator = withoutCreator.replace(
      new RegExp(`\\b(?:by\\s+)?${escapeRegExp(item.creator.trim())}\\b`, 'gi'),
      ''
    );
  }
  withoutCreator = withoutCreator.replace(/\bby\s+[^,.]+$/i, '').trim();

  if (withoutCreator.length < 18) return true;
  if (WIKI_BOILERPLATE_CLUE_PATTERNS.test(withoutCreator) && withoutCreator.length < 48) {
    return true;
  }
  return false;
}

export function sanitizeWikiHint(params: {
  category: 'music' | 'books' | 'art';
  title?: string;
  creator?: string;
  year?: number;
  rawDescription?: string;
  wikiExtract?: string;
  altTitles?: string[];
  altCreators?: string[];
}): string {
  const { category, title, creator, year, rawDescription, wikiExtract, altTitles, altCreators } = params;

  const scrubbedDesc = stripYearSpoilers(rawDescription || '', year);
  if (scrubbedDesc && !isThinClueText(scrubbedDesc, { title, creator })) {
    const redactedDesc = redactWorkIdentifiers(scrubbedDesc, {
      title,
      creator,
      altTitles,
      altCreators,
    });
    if (redactedDesc.length >= 24) {
      return redactedDesc;
    }
  }

  if (wikiExtract) {
    const rawSentences = wikiExtract
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘'])/)
      .map(s => s.trim())
      .filter(Boolean);

    // Prefer later descriptive sentences first, then redacted sentence 1
    const orderedSentences =
      rawSentences.length > 1 ? [...rawSentences.slice(1), rawSentences[0]] : rawSentences;

    for (const sentence of orderedSentences) {
      let cleaned = stripYearSpoilers(sentence, year);
      cleaned = redactWorkIdentifiers(cleaned, { title, creator, altTitles, altCreators });
      cleaned = cleaned.replace(/^this work\s+is\s+(?:the\s+|a\s+|an\s+)?/i, '');
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

      if (cleaned.length >= 28 && !GENERIC_GENRE_PATTERNS.test(cleaned)) {
        return cleaned;
      }
    }
  }

  if (category === 'music') {
    return 'An influential release noted for its distinctive cover aesthetic and musical impact.';
  }
  if (category === 'books') {
    return 'A memorable literary work recognized for its distinctive storytelling and cultural footprint.';
  }
  return 'A celebrated visual work recognized for its distinctive composition and palette.';
}

export function generateQuirkyHint(item: CulturalItem): { riddle: string; initials: string } {
  const maskWord = (word: string) => {
    if (word.length <= 2) return word;
    return word[0] + '_'.repeat(word.length - 1);
  };

  const creatorMasked = item.creator.split(/\s+/).map(maskWord).join(' ');
  const titleMasked = item.title.split(/\s+/).map(maskWord).join(' ');

  const initials = `${titleMasked} by ${creatorMasked}`;
  const eraLabel = getBroadEraLabel(item.year);

  const cleanGenre = stripYearSpoilers(item.genreOrMovement || '', item.year)
    .replace(/\bby\s+.+$/i, '')
    .trim();
  const displayGenre =
    cleanGenre && !GENERIC_GENRE_PATTERNS.test(cleanGenre) ? ` • ${cleanGenre}` : '';

  const scrubbedHint1 = stripYearSpoilers(item.hint1 || '', item.year);
  let clueBody = scrubbedHint1;

  if (isThinClueText(scrubbedHint1, item)) {
    clueBody = sanitizeWikiHint({
      category: item.category,
      title: item.title,
      creator: item.creator,
      year: item.year,
      rawDescription: item.hint1,
      wikiExtract: item.wikiExtract || item.trivia,
      altTitles: item.altTitles,
      altCreators: item.altCreators,
    });
  }

  // Final safeguard: never allow the target year or any 4-digit release year inside the clue
  const safeClueBody = stripYearSpoilers(clueBody, item.year);

  const categoryPrefixes: Record<CulturalItem['category'], string> = {
    music: `🎵 ${eraLabel}${displayGenre}`,
    books: `📚 ${eraLabel}${displayGenre}`,
    art: `🎨 ${eraLabel}${displayGenre}`,
  };

  const prefix = categoryPrefixes[item.category] || eraLabel;
  const rawRiddle = safeClueBody ? `${prefix} — ${safeClueBody}` : prefix;

  return {
    riddle: stripYearSpoilers(rawRiddle, item.year),
    initials,
  };
}
