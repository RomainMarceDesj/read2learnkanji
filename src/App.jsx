import React, { useState, useEffect, useRef } from 'react';
import Word from './Components/Word';
import './App.css';
import axios from 'axios';

const MemoizedWord = React.memo(Word);

function App() {
  const [wordData, setWordData] = useState([]);
  const [pageSizeCharacter, setPageSizeCharacter] = useState(1000);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalLength, setTotalLength] = useState(0);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef(null);
  const [prefetchedData, setPrefetchedData] = useState({});
  const [selectedBook, setSelectedBook] = useState(null); // New state for pre-selected books

  const fileName = file ? file.name : selectedBook;

  useEffect(() => {
    // Determine which API call to make based on file or selected book
    if (file) {
      const pageKey = `page_${currentPage}`;
      if (prefetchedData[pageKey]) {
        setWordData(prefetchedData[pageKey].data);
        setTotalLength(prefetchedData[pageKey].totalLength);
        setIsLoading(false);
      } else {
        fetchAPI(currentPage, (data) => {
          setWordData(data.data);
          setTotalLength(data.totalLength);
        });
      }
      prefetchNextPages();
    } else if (selectedBook) {
      const pageKey = `page_${currentPage}`;
      if (prefetchedData[pageKey]) {
        setWordData(prefetchedData[pageKey].data);
        setTotalLength(prefetchedData[pageKey].totalLength);
        setIsLoading(false);
      } else {
        fetchAPI(currentPage, (data) => {
          setWordData(data.data);
          setTotalLength(data.totalLength);
        });
      }
      prefetchNextPages();
    }
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [file, selectedBook, currentPage]);

  const prefetchNextPages = () => {
    const pagesToPrefetch = 2;
    for (let i = 1; i <= pagesToPrefetch; i++) {
      const pageToFetch = currentPage + i;
      const pageKey = `page_${pageToFetch}`;
      
      if (!prefetchedData[pageKey] && (pageToFetch * pageSizeCharacter) < totalLength) {
        fetchAPI(pageToFetch, (data) => {
          setPrefetchedData(prev => ({ ...prev, [pageKey]: data }));
        });
      }
    }
  };

  const handleFileChange = (event) => {
    // Reset selected book when a file is uploaded
    setSelectedBook(null);
    setFile(event.target.files[0]);
    setCurrentPage(0);
    setPrefetchedData({});
  };

  const handleBookSelect = (bookName) => {
    // Reset uploaded file when a pre-selected book is chosen
    setFile(null);
    setSelectedBook(bookName);
    setCurrentPage(0);
    setPrefetchedData({});
  };

  const handleCancel = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      setIsLoading(false);
      console.log("Request cancelled.");
    }
  };

  const handleReset = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setWordData([]);
    setCurrentPage(0);
    setTotalLength(0);
    setFile(null);
    setSelectedBook(null); // Reset selected book
    setIsLoading(false);
    setPrefetchedData({});
    document.getElementById('file-input').value = null;
  };

  async function fetchAPI(pageNumber, onSuccess) {
    setIsLoading(true);
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;
    
    let response;
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('start_position', pageNumber * pageSizeCharacter);
        formData.append('page_size', pageSizeCharacter);
        formData.append('filepath', fileName);
        response = await axios.post('http://127.0.0.1:8080/analyze', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: signal,
        });
      } else if (selectedBook) {
        response = await axios.post('http://127.0.0.1:8080/analyze', {
          filepath: selectedBook,
          start_position: pageNumber * pageSizeCharacter,
          page_size: pageSizeCharacter,
        }, {
          signal: signal,
        });
      } else {
        // No file or book selected, do nothing
        setIsLoading(false);
        return;
      }

      onSuccess(response.data);
      setIsLoading(false);

    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request aborted by user');
      } else {
        console.error("Error fetching data:", error);
      }
      setIsLoading(false);
    }
  }

  function handleSwipe(id) {
    setWordData(prev =>
      prev.map(paragraph =>
        paragraph.map(word => {
          if (word.id !== id) return word;
          return {
            ...word,
            showFurigana: !word.showFurigana || !word.showTranslation ? true : false,
            showTranslation: !word.showTranslation,
          };
        })
      )
    );
  }

  const handleNextPage = () => {
    if ((currentPage + 1) * pageSizeCharacter < totalLength) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  const handlePrevPage = () => {
    setCurrentPage(prevPage => Math.max(0, prevPage - 1));
  };

  const paragraphElement = wordData.map((show, i) => (
    <p key={i}>
      {show.map((item, j) => (
        <MemoizedWord
          key={item.id ?? `text-${i}-${j}`}
          handleSwipe={handleSwipe}
          furigana={item.furigana}
          translation={item.translation}
          kanji={item.kanji}
          showFurigana={item.showFurigana}
          showTranslation={item.showTranslation}
          type={item.type}
          id={item.id}
          value={item.value}
        />
      ))}
    </p>
  ));

  return (
    <>
      <h1>Japanese Text Reader</h1>
      
      <div className="file-upload">
        <input type="file" onChange={handleFileChange} id="file-input" />
        {isLoading && <button onClick={handleCancel}>Cancel</button>}
        <button onClick={handleReset}>Reset</button>
      </div>

      <div className="pre-selected-books">
        <p>Or choose a pre-selected book:</p>
        <button onClick={() => handleBookSelect('wagahaiwa_nekodearu.txt')}>Wagahai Wa Neko De Aru (dificult)</button>
        <button onClick={() => handleBookSelect('momotaro.txt')}>momotaro (easy)</button>
        <button onClick={() => handleBookSelect('Book3.txt')}>Book 3</button>
      </div>

      <div className="page-navigation">
        <button onClick={handlePrevPage} disabled={currentPage === 0}>Previous Page</button>
        <span>Page {currentPage + 1}</span>
        <button onClick={handleNextPage} disabled={(currentPage + 1) * pageSizeCharacter >= totalLength}>Next Page</button>
      </div>

      <div className="main_text" style={{ lineHeight: 1.8 }}>
        {isLoading && !prefetchedData[`page_${currentPage}`] ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="jisage_8" style={{ marginLeft: '8em' }}>
              <h4 className="naka-midashi">
                <a className="midashi_anchor" id="midashi10">一</a>
              </h4>
            </div>
            {paragraphElement}
          </>
        )}
      </div>
    </>
  );
}

export default App;