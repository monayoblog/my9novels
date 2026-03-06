import { useState, useEffect, useRef, useCallback } from "react";

// ========== 設定 ==========
const AFFILIATE_TAG = "my9novels-22";
const SITE_URL = "https://my9novels.vercel.app"; // ← ドメイン反映後に https://my9novels.com に変更
const HASHTAG = "#My9Novels #私を構成する9冊の小説";

// ========== 画像プロキシ ==========
function proxyImageUrl(url) {
  if (!url) return "";
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=300&h=450&fit=cover`;
}

// ========== ユーティリティ ==========
function generateAmazonUrl(title, author) {
  const q = encodeURIComponent(`${title} ${author || ""}`.trim());
  return `https://www.amazon.co.jp/s?k=${q}&i=stripbooks&tag=${AFFILIATE_TAG}`;
}

function encodeShareData(books, comments, userName) {
  const data = { b: [], c: comments, u: userName };
  books.forEach((book, i) => {
    if (book) data.b.push({ i, id: book.id, t: book.title, a: book.author, img: book.originalThumbnail || book.thumbnail });
  });
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch { return ""; }
}

function decodeShareData(hash) {
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    return JSON.parse(json);
  } catch { return null; }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ========== 検索API ==========
function proxyImageUrl(url) {
  if (!url) return "";
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

async function searchBooks(query) {
  if (!query || query.length < 2) return [];
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&langRestrict=ja&printType=books&key=AIzaSyCb7VmvDZvq39WzG9bX-3wo1x1llIWLWzk`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Google Books API error:", res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    if (!data.items || data.items.length === 0) return [];
    return data.items.map((item) => {
      const rawThumb = item.volumeInfo.imageLinks
        ? (item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail || "").replace("http://", "https://")
        : "";
      return {
        id: item.id,
        title: item.volumeInfo.title || "タイトル不明",
        author: (item.volumeInfo.authors || []).join(", ") || "",
        thumbnail: rawThumb,
        proxiedThumbnail: proxyImageUrl(rawThumb),
        publishedDate: item.volumeInfo.publishedDate || "",
      };
    });
  } catch (err) {
    console.error("Search error:", err);
    return [];
  }
}

// ========== メインコンポーネント ==========
export default function App() {
  const [books, setBooks] = useState(Array(9).fill(null));
  const [comments, setComments] = useState({});
  const [userName, setUserName] = useState("");
  const [activeSlot, setActiveSlot] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [commentSlot, setCommentSlot] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [isSharedView, setIsSharedView] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const gridRef = useRef(null);
  const searchInputRef = useRef(null);

  // html2canvas読み込み
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    document.head.appendChild(s);
  }, []);

  // 共有URL読み込み
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const data = decodeShareData(hash);
      if (data && data.b) {
        const newBooks = Array(9).fill(null);
        data.b.forEach((b) => { 
          const proxied = b.img ? `https://images.weserv.nl/?url=${encodeURIComponent(b.img)}&w=300&h=450&fit=cover` : "";
          newBooks[b.i] = { id: b.id, title: b.t, author: b.a, originalThumbnail: b.img, thumbnail: proxied }; 
        });
        setBooks(newBooks);
        setComments(data.c || {});
        setUserName(data.u || "");
        setIsSharedView(true);
      }
    }
  }, []);

  // 検索デバウンス
  const debouncedSearch = useCallback(
    debounce(async (q) => {
      if (q.length < 2) { setSearchResults([]); setSearching(false); setSearchError(""); return; }
      setSearching(true);
      setSearchError("");
      try {
        const results = await searchBooks(q);
        setSearchResults(results);
        if (results.length === 0) setSearchError("");
      } catch (err) {
        setSearchError("検索に失敗しました: " + err.message);
      }
      setSearching(false);
    }, 350),
    []
  );

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    debouncedSearch(q);
  };

  const openSearch = (slotIndex) => {
    setActiveSlot(slotIndex);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const selectBook = (book) => {
    const newBooks = [...books];
    newBooks[activeSlot] = {
      ...book,
      originalThumbnail: book.thumbnail,
      thumbnail: book.thumbnail ? `https://images.weserv.nl/?url=${encodeURIComponent(book.thumbnail)}&w=300&h=450&fit=cover` : "",
    };
    setBooks(newBooks);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeBook = (index) => {
    const newBooks = [...books];
    newBooks[index] = null;
    setBooks(newBooks);
    const newComments = { ...comments };
    delete newComments[index];
    setComments(newComments);
  };

  const openComment = (index) => {
    setCommentSlot(index);
    setCommentText(comments[index] || "");
    setShowComment(true);
  };

  const saveComment = () => {
    if (commentText.trim()) {
      setComments({ ...comments, [commentSlot]: commentText.trim() });
    } else {
      const c = { ...comments };
      delete c[commentSlot];
      setComments(c);
    }
    setShowComment(false);
  };

  const selectedCount = books.filter(Boolean).length;

  // 画像保存
  const saveImage = async () => {
    if (!window.html2canvas || !gridRef.current) return;
    setSaving(true);
    try {
      const canvas = await window.html2canvas(gridRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = "my9novels.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) { console.error("Save failed:", e); }
    setSaving(false);
  };

  // Xシェア
  const shareToX = () => {
    const titles = books.filter(Boolean).slice(0, 5).map((b) => b.title).join("、");
    const text = userName
      ? `${userName}を構成する9冊の小説\n${titles}${selectedCount > 5 ? " ほか" : ""}\n\n${SITE_URL}\n${HASHTAG}`
      : `私を構成する9冊の小説\n${titles}${selectedCount > 5 ? " ほか" : ""}\n\n${SITE_URL}\n${HASHTAG}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=550,height=420");
  };

  // 共有URL
  const copyShareUrl = () => {
    const hash = encodeShareData(books, comments, userName);
    const url = `${SITE_URL}#${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 自分の9選を新しく作る
  const resetForOwn = () => {
    setBooks(Array(9).fill(null));
    setComments({});
    setUserName("");
    setIsSharedView(false);
    window.location.hash = "";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&family=Shippori+Mincho:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fafafa; }

        .grid-slot {
          aspect-ratio: 3/4;
          border: 2px dashed #ddd;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
          background: #fff;
        }
        .grid-slot:hover { border-color: #4a90d9; background: #f8fbff; }
        .grid-slot.filled { border: none; cursor: default; }
        .grid-slot.filled:hover { background: #fff; }
        .grid-slot .cover-img {
          width: 100%; height: 100%;
          object-fit: cover;
          border-radius: 8px;
        }

        .slot-actions {
          position: absolute;
          top: 6px; right: 6px;
          display: flex; flex-direction: column; gap: 4px;
          opacity: 0; transition: opacity 0.2s;
        }
        .grid-slot:hover .slot-actions { opacity: 1; }

        .action-btn {
          width: 30px; height: 30px;
          border-radius: 50%;
          border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .action-btn:hover { transform: scale(1.1); }
        .action-close { background: #fff; color: #e74c3c; }
        .action-comment { background: #fff; color: #4a90d9; }

        .slot-number {
          position: absolute;
          top: 6px; left: 8px;
          font-size: 13px; font-weight: 600;
          color: #bbb;
          z-index: 1;
        }
        .grid-slot.filled .slot-number { 
          color: #fff;
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }

        .comment-badge {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          background: rgba(0,0,0,0.65);
          color: #fff;
          font-size: 11px;
          padding: 4px 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
          animation: fadeIn 0.2s;
        }
        .modal-box {
          background: #fff;
          border-radius: 16px;
          width: 90%; max-width: 480px;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          animation: slideUp 0.25s ease-out;
        }

        .search-input {
          width: 100%;
          padding: 14px 16px 14px 44px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          font-size: 16px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
          transition: border-color 0.2s;
        }
        .search-input:focus { border-color: #4a90d9; }
        .search-input::placeholder { color: #bbb; }

        .search-result {
          display: flex; gap: 12px; padding: 12px 16px;
          cursor: pointer; transition: background 0.15s;
          align-items: center;
          border-bottom: 1px solid #f0f0f0;
        }
        .search-result:hover { background: #f5f8ff; }
        .search-result:last-child { border-bottom: none; }
        .result-thumb {
          width: 44px; height: 60px;
          object-fit: cover;
          border-radius: 4px;
          flex-shrink: 0;
          background: #f0f0f0;
        }

        .main-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 24px;
          border: none; border-radius: 10px;
          font-size: 14px; font-weight: 600;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer; transition: all 0.2s;
          flex: 1;
        }
        .main-btn:hover { transform: translateY(-1px); }
        .main-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .btn-save { background: #2c3e50; color: #fff; }
        .btn-save:hover:not(:disabled) { background: #1a252f; box-shadow: 0 4px 12px rgba(44,62,80,0.3); }
        .btn-x { background: #000; color: #fff; }
        .btn-x:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .btn-share { background: #fff; color: #333; border: 1.5px solid #ddd; }
        .btn-share:hover:not(:disabled) { border-color: #4a90d9; color: #4a90d9; }
        .btn-reset { background: #fff; color: #e74c3c; border: 1.5px solid #eee; }
        .btn-reset:hover { border-color: #e74c3c; }

        .name-input {
          text-align: center;
          font-family: 'Shippori Mincho', serif;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-bottom: 1.5px solid #ddd;
          padding: 4px 8px;
          outline: none;
          background: transparent;
          color: #333;
          width: 200px;
          transition: border-color 0.2s;
        }
        .name-input:focus { border-color: #4a90d9; }
        .name-input::placeholder { color: #ccc; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ヘッダー */}
      <div style={{ textAlign: "center", padding: "40px 20px 8px" }}>
        <p style={{ fontSize: 13, color: "#999", marginTop: 6, letterSpacing: 2 }}>My 9 Novels</p>
        <h1 style={{
          fontFamily: "'Shippori Mincho', serif",
          fontSize: "clamp(22px, 5vw, 32px)",
          fontWeight: 700,
          color: "#222",
          letterSpacing: 2,
          marginTop: 6,
        }}>
          私を構成する9冊の小説
        </h1>
      </div>

      {/* メインコンテンツ */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "12px 16px 40px" }}>

        {/* ユーザー名 */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {isSharedView ? (
            <p style={{ fontFamily: "'Shippori Mincho', serif", fontSize: 16, fontWeight: 600, color: "#333" }}>
              {userName || "名無し"}さんの9冊
            </p>
          ) : (
            <input
              className="name-input"
              type="text"
              placeholder="あなたの名前（任意）"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              maxLength={20}
            />
          )}
        </div>

        {/* 9マスグリッド（画像保存対象） */}
        <div ref={gridRef} style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
          {/* グリッド内タイトル（画像保存時に含まれる） */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "'Shippori Mincho', serif", fontSize: 14, color: "#666", letterSpacing: 1 }}>
              {userName ? `${userName}を構成する9冊の小説` : "私を構成する9冊の小説"}
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}>
            {books.map((book, i) => (
              <div
                key={i}
                className={`grid-slot ${book ? "filled" : ""}`}
                onClick={() => !book && !isSharedView && openSearch(i)}
              >
                <span className="slot-number">{i + 1}</span>

                {book ? (
                  <>
                    {book.thumbnail ? (
                      <img className="cover-img" src={book.thumbnail} alt={book.title} crossOrigin="anonymous" />
                    ) : (
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "#f0f0f0", borderRadius: 8,
                        padding: 8, textAlign: "center",
                      }}>
                        <span style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{book.title}</span>
                      </div>
                    )}

                    {comments[i] && <div className="comment-badge">{comments[i]}</div>}

                    {!isSharedView && (
                      <div className="slot-actions">
                        <button className="action-btn action-close" onClick={(e) => { e.stopPropagation(); removeBook(i); }} title="削除">✕</button>
                        <button className="action-btn action-comment" onClick={(e) => { e.stopPropagation(); openComment(i); }} title="コメント">💬</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 28, color: "#ccc", fontWeight: 300, lineHeight: 1 }}>+</span>
                    <span style={{ fontSize: 11, color: "#bbb" }}>選択</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* フッター情報 */}
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "#ccc" }}>Books data powered by Google Books</span>
          </div>
        </div>

        {/* カウンター */}
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#999" }}>
          {selectedCount} / 9 選択済み
          {selectedCount < 9 && !isSharedView && <span style={{ color: "#4a90d9", marginLeft: 8 }}>あと{9 - selectedCount}冊</span>}
        </div>

        {/* Amazonで探す */}
        {books.some(Boolean) && (
          <div style={{
            marginTop: 20,
            background: "#fffbf0",
            border: "1.5px solid #ffe4a0",
            borderRadius: 14,
            padding: "18px 16px",
          }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#333" }}>Amazonで探す</span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8,
            }}>
              {books.map((book, i) =>
                book ? (
                  <a
                    key={i}
                    href={generateAmazonUrl(book.title, book.author)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      background: "#fff",
                      border: "1.5px solid #f0e0c0",
                      borderRadius: 10,
                      textDecoration: "none",
                      transition: "all 0.15s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ff9900"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(255,153,0,0.15)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#f0e0c0"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <span style={{
                      width: 24, height: 24,
                      borderRadius: "50%",
                      background: "#ff9900",
                      color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                      flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 500, color: "#333",
                      flex: 1, minWidth: 0,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{book.title}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#999" style={{ flexShrink: 0 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="#999" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                ) : null
              )}
            </div>
          </div>
        )}

        {/* コメント一覧（コメントがある場合のみ表示） */}
        {Object.keys(comments).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>💬 コメント</span>
            {books.map((book, i) =>
              book && comments[i] ? (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#bbb", width: 18, textAlign: "center", flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{book.title}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{comments[i]}</div>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* アクションボタン */}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {isSharedView ? (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="main-btn btn-save" onClick={saveImage}>
                  📷 画像を保存
                </button>
                <button className="main-btn btn-x" onClick={shareToX}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  シェア
                </button>
              </div>
              <button className="main-btn btn-reset" onClick={resetForOwn}>
                自分の9冊を作る
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="main-btn btn-save" onClick={saveImage} disabled={selectedCount === 0 || saving}>
                  {saving ? "保存中..." : "📷 画像を保存"}
                </button>
                <button className="main-btn btn-x" onClick={shareToX} disabled={selectedCount === 0}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Xでシェア
                </button>
              </div>
              <button className="main-btn btn-share" onClick={copyShareUrl} disabled={selectedCount === 0}>
                {copied ? "✅ コピーしました！" : "🔗 共有リンクを作成"}
              </button>
              <button className="main-btn btn-reset" onClick={resetForOwn} disabled={selectedCount === 0}>
                🗑 クリア
              </button>
            </>
          )}
        </div>

        {/* 注意書き */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#bbb", lineHeight: 1.8 }}>
          <p>※ Amazonアソシエイトのリンクを含みます</p>
          <p style={{ marginTop: 4 }}>
            by <a href={SITE_URL} style={{ color: "#999" }}>My9Novels</a>
          </p>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "center", gap: 16 }}>
            <button
              onClick={() => setShowTerms(true)}
              style={{ background: "none", border: "none", color: "#bbb", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
            >利用規約</button>
            <button
              onClick={() => setShowPrivacy(true)}
              style={{ background: "none", border: "none", color: "#bbb", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
            >プライバシーポリシー</button>
          </div>
        </div>
      </div>

      {/* 検索モーダル */}
      {showSearch && (
        <div className="modal-overlay" onClick={() => setShowSearch(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#333" }}>小説を検索</h3>
                <button
                  onClick={() => setShowSearch(false)}
                  style={{ background: "none", border: "none", fontSize: 20, color: "#999", cursor: "pointer", padding: 4 }}
                >✕</button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#bbb" }}>🔍</span>
                <input
                  ref={searchInputRef}
                  className="search-input"
                  type="text"
                  placeholder="タイトルや著者名で検索..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
            </div>

            <div style={{ maxHeight: "50vh", overflowY: "auto", marginTop: 12 }}>
              {searching && (
                <div style={{ textAlign: "center", padding: 24, color: "#999", fontSize: 14 }}>検索中...</div>
              )}
              {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div style={{ textAlign: "center", padding: 24, color: "#bbb", fontSize: 13 }}>
                  {searchError || "見つかりませんでした。別のキーワードで試してみてください。"}
                </div>
              )}
              {!searching && searchQuery.length < 2 && searchQuery.length > 0 && (
                <div style={{ textAlign: "center", padding: 24, color: "#bbb", fontSize: 13 }}>
                  2文字以上入力してください
                </div>
              )}
              {searchResults.map((result) => (
                <div key={result.id} className="search-result" onClick={() => selectBook(result)}>
                  {result.thumbnail ? (
                    <img className="result-thumb" src={result.thumbnail} alt="" />
                  ) : (
                    <div className="result-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, color: "#bbb" }}>No Image</span>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#333", lineHeight: 1.4 }}>{result.title}</div>
                    {result.author && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{result.author}</div>}
                    {result.publishedDate && <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{result.publishedDate.slice(0, 4)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* コメントモーダル */}
      {showComment && (
        <div className="modal-overlay" onClick={() => setShowComment(false)}>
          <div className="modal-box" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#333" }}>
                💬 ひとことコメント
              </h3>
              <button
                onClick={() => setShowComment(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "#999", cursor: "pointer", padding: 4 }}
              >✕</button>
            </div>
            {books[commentSlot] && (
              <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
                {books[commentSlot].title}
              </div>
            )}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="この小説への想いを一言..."
              maxLength={60}
              style={{
                width: "100%", height: 80,
                border: "1.5px solid #e0e0e0", borderRadius: 10,
                padding: 12, fontSize: 14,
                fontFamily: "'Noto Sans JP', sans-serif",
                outline: "none", resize: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#4a90d9")}
              onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "#bbb" }}>{commentText.length} / 60</span>
              <button
                onClick={saveComment}
                style={{
                  background: "#4a90d9", color: "#fff",
                  border: "none", borderRadius: 8,
                  padding: "8px 20px", fontSize: 14, fontWeight: 600,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 利用規約モーダル */}
      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-box" style={{ padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#333" }}>利用規約</h3>
              <button
                onClick={() => setShowTerms(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "#999", cursor: "pointer", padding: 4 }}
              >✕</button>
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 2 }}>
              <p>・本サービスは非営利の個人開発ツールです。</p>
              <p>・画像の権利は各権利者に帰属します。</p>
              <p>・公序良俗に反する使用を禁じます。</p>
              <p>・本サービスの書籍情報は Google Books API を利用しています。情報の正確性・完全性は保証しません。</p>
              <p>・Amazonリンクは書籍名等を用いた検索ページへ遷移します。個別商品ページへの一致・在庫・価格・表示順は保証しません。</p>
              <p>・外部サイト側の変更、削除、移転等によりリンク切れや内容変更が発生する場合があり、運営者は保証しません。</p>
              <p>・運営者は、メンテナンス、障害対応、その他必要な場合に、本サービスの全部または一部を中断・変更・終了できるものとします。</p>
              <p>・本サービスは現状有姿で提供されます。利用者が本サービスの利用により被った損害について、運営者に故意または重過失がある場合を除き責任を負いません。</p>
            </div>
          </div>
        </div>
      )}

      {/* プライバシーポリシーモーダル */}
      {showPrivacy && (
        <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="modal-box" style={{ padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#333" }}>プライバシーポリシー</h3>
              <button
                onClick={() => setShowPrivacy(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "#999", cursor: "pointer", padding: 4 }}
              >✕</button>
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 2 }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>取得する情報</p>
              <p>・本サービスは、ユーザーが入力した書籍の選択情報・コメント・名前をブラウザ上でのみ処理し、外部サーバーへの送信・保存は行いません。</p>
              <p>・共有URL機能を利用した場合、選択データはURL内に含まれます。URLを共有した相手がその内容を閲覧できます。</p>
              <p style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 }}>外部サービス</p>
              <p>・書籍情報の取得に Google Books API を使用しています。Google のプライバシーポリシーが適用されます。</p>
              <p>・Amazonアソシエイトプログラムに参加しており、リンク経由の購入に対して紹介料が発生する場合があります。</p>
              <p>・アクセス解析のため、Google Analytics 等の解析ツールを導入する場合があります。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
