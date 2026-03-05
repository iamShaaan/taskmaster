import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '../firebase/config';

export const DebugScript: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    // get tasks for this project
    const q = query(collection(db, `apps/${APP_ID}/tasks`));
    getDocs(q).then(snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.title === "Bug fixing + Add notes for project"));
    });
  }, []);
  
  return (
    <div style={{ padding: 20, color: 'white' }}>
      <h1>Debug Tasks</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};
