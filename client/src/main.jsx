import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { AppProvider } from './lib/app.jsx';
import Home from './pages/Home.jsx';
import Journey from './pages/Journey.jsx';
import Track from './pages/Track.jsx';
import ConsoleLayout from './console/ConsoleLayout.jsx';
import Overview from './console/Overview.jsx';
import Leads from './console/Leads.jsx';
import Orders from './console/Orders.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/apply/:id/:step?" element={<Journey />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:orderId" element={<Track />} />
          <Route path="/console" element={<ConsoleLayout />}>
            <Route index element={<Overview />} />
            <Route path="leads" element={<Leads />} />
            <Route path="orders" element={<Orders />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>,
);
