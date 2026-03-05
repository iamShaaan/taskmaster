import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '../firebase/config';

export const DebugScript2: React.FC = () => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    getDoc(doc(db, `apps/${APP_ID}/projects`, 'NPm1TVPPpLMD3toYZdQ2')).then(snap => {
      setData({ id: snap.id, ...snap.data() });
    });
  }, []);
  
  return (
    <div style={{ padding: 20, color: 'white' }}>
      <h1>Debug Project 2</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};
