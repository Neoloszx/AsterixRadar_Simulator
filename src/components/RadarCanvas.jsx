// src/components/RadarCanvas.jsx
import React, { useRef, useEffect, useState } from "react";
import cat10Data from "../data/cat10.json";
import cat240Data from "../data/cat240.json";
import cat48Data from "../data/cat48.json";

const DEFAULT_CENTER = { lat: 13.7367, lon: 100.5231 };

// helper
const degLatToMeters = (deg) => deg * 111320;
const degLonToMeters = (deg, atLat) => deg * (111320 * Math.cos((atLat * Math.PI) / 180));

const RadarCanvas = ({showCAT10, showCAT21, showCAT240, showCAT48, wsUrl }) => {
  const canvasRef = useRef(null);
  const [cat21Targets, setCat21Targets] = useState([]);
  const wsRef = useRef(null);

  // ----- WebSocket -----
  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log("[RadarCanvas] WS connected");
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.cat21) {
          // normalize coordinates
          const targets = data.cat21.map((p) => {
            if (!p.wgs_84_coordinates) {
              if (p.latitude !== undefined && p.longitude !== undefined) {
                p.wgs_84_coordinates = { latitude: p.latitude, longitude: p.longitude };
              } else {
                p.wgs_84_coordinates = { latitude: 13.7367, longitude: 100.5231 };
              }
            }
            if (p.radius === undefined || p.radius === null) p.radius = 1000;
            return p;
          });
          setCat21Targets(targets);
        }
      } catch (err) {
        console.error("[RadarCanvas] WS parse error:", err);
      }
    };

    ws.onclose = () => {
      console.log("[RadarCanvas] WS disconnected");
      setCat21Targets([]);
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          const w = new WebSocket(wsUrl);
          wsRef.current = w;
          w.onopen = ws.onopen;
          w.onmessage = ws.onmessage;
          w.onclose = ws.onclose;
          w.onerror = ws.onerror;
        }
      }, 2000);
    };

    ws.onerror = (err) => console.warn("[RadarCanvas] WS error", err);

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [wsUrl]);

  // ----- Draw loop -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radarPixelRadius = Math.min(canvas.width, canvas.height) / 2 - 20;

    const centerLat = DEFAULT_CENTER.lat;
    const centerLon = DEFAULT_CENTER.lon;

    // mapping lat/lon -> canvas xy
    const latLonToXY = (lat, lon) => {
      const dx = lon - centerLon;
      const dy = lat - centerLat;
      // approximate scale: 0.05 deg ~ max radius 1km
      const px = centerX + dx * radarPixelRadius / 0.05;
      const py = centerY - dy * radarPixelRadius / 0.05;
      return { x: px, y: py };
    };

    let rafId = null;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);


      
	// draw radar circle with 4 concentric circles
	ctx.strokeStyle = "green";
	ctx.lineWidth = 2;

	// วงกลมใหญ่สุด = radarPixelRadius
	const numCircles = 4;
	for (let i = 1; i <= numCircles; i++) {
	  const radius = (radarPixelRadius / numCircles) * i;
	  ctx.beginPath();
	  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	  ctx.stroke();
	}

	// วาด cross และ center label เหมือนเดิม
	ctx.beginPath();
	ctx.moveTo(centerX - 10, centerY);
	ctx.lineTo(centerX + 10, centerY);
	ctx.moveTo(centerX, centerY - 10);
	ctx.lineTo(centerX, centerY + 10);
	ctx.strokeStyle = "white";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.fillStyle = "white";
	ctx.font = "11px Arial";
	ctx.fillText(`center ${centerLat.toFixed(5)},${centerLon.toFixed(5)}`, centerX + 12, centerY - 12);


      // center cross
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY);
      ctx.lineTo(centerX + 10, centerY);
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(centerX, centerY + 10);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = "11px Arial";
      ctx.fillText(`center ${centerLat.toFixed(5)},${centerLon.toFixed(5)}`, centerX + 12, centerY - 12);
	// สมมติมี list สนามบิน
	const airports = [
	{
	name: "VTBS",
	wgs_84_coordinates: { latitude: 13.7200, longitude: 100.5500 },
	approachAngles: [0, 45, 90, 135] // องศาของ runway approach
	},
	{
	name: "VTBD",
	wgs_84_coordinates: { latitude: 13.7500, longitude: 100.5200 },
	approachAngles: [30, 210]
	}
	];

	// mapping function lat/lon -> x/y อยู่แล้ว: latLonToXY(lat, lon)

	// วาดสนามบินและ approach
	airports.forEach((airport) => {
	const { x, y } = latLonToXY(
	airport.wgs_84_coordinates.latitude,
	airport.wgs_84_coordinates.longitude
	);

	// จุดสนามบิน
	ctx.beginPath();
	ctx.arc(x, y, 8, 0, Math.PI * 2);
	ctx.fillStyle = "green";
	ctx.fill();

	// Label สนามบิน
	ctx.fillStyle = "white";
	ctx.font = "12px Arial";
	ctx.fillText(airport.name, x + 10, y - 10);

	// วาด runway / approach lines
	airport.approachAngles.forEach((angleDeg) => {
	const angleRad = (angleDeg * Math.PI) / 180;
	const length = 80; // ความยาวเส้น approach
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + length * Math.cos(angleRad), y - length * Math.sin(angleRad)); // y inverted
	ctx.strokeStyle = "white";
	ctx.lineWidth = 1;
	ctx.stroke();
	});
	});

      // CAT21
      if (showCAT21 && cat21Targets.length > 0) {
        cat21Targets.forEach((p, i) => {
          const lat = p.wgs_84_coordinates.latitude;
          const lon = p.wgs_84_coordinates.longitude;
          if (typeof lat !== "number" || typeof lon !== "number") return;
          const { x, y } = latLonToXY(lat, lon);

          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = "red";
          ctx.fill();

          ctx.fillStyle = "white";
          ctx.font = "12px Arial";
          //ctx.fillText(`${p.target_identification || p.id || ''} ${p.flight_level || ''}`.trim(), x + 8, y - 8);
          ctx.fillText(`${p.target_identification || p.id || ''} ${p.flight_level || ''}`.trim(), x + 8, y - 8);
	  // บรรทัดสอง
	ctx.fillText(`${p.callsign || 'Unknown'}`, x + 8, y + 8);
        });
      }

      //CAT10 == CAT21 but DATA at top left corner
      if (showCAT10 && cat21Targets.length > 0) {
		const blockWidth = 220;   // ความกว้างของบล็อก
		const blockHeight = 80;   // ความสูงของบล็อก
		const startX = 30;        // เริ่มวาดจากขอบซ้าย
		const startY = 30;        // เริ่มวาดจากขอบบน
		const gap = 10;           // ระยะห่างระหว่างบล็อก
		

		cat21Targets.forEach((p, i) => {
		const x = startX;
		const y = startY + i * (blockHeight + gap);

		// วาดพื้นหลังของบล็อก
		ctx.fillStyle = "blue";
		ctx.fillRect(x, y, blockWidth, blockHeight);

		// วาดขอบบล็อก (optional)
		ctx.strokeStyle = "white";
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, blockWidth, blockHeight);
		
		

		// ข้อความในบล็อก
		const label1 = `Radar Type : Dolpper and Pulse radar`;
		const label2 = `Squawk code: "Squawk 7000"`;
		const label3 = `Flight Level: ${p.flight_level || "???"}`;
		const label4 = `Identification: ${p.target_identification || "-"}`;

		ctx.fillStyle = "white";
		ctx.font = "12px Arial";
		ctx.fillText(label1, x + 10, y + 15);
		ctx.fillText(label2, x + 10, y + 30);
		ctx.fillText(label3, x + 10, y + 45);
		ctx.fillText(label4, x + 10, y + 60);
		});
      }
      if (showCAT240) {
        cat240Data.forEach((t) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, (t.amplitude || 30) / 30, 0, Math.PI * 2);
          ctx.strokeStyle = "yellow";
          ctx.stroke();
        });
      }
      if (showCAT48) {
        cat48Data.forEach((track) => {
          ctx.beginPath();
          track.trail.forEach((pt, idx) => idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => rafId && cancelAnimationFrame(rafId);
  }, [showCAT10, showCAT21, showCAT240, showCAT48, cat21Targets]);

  return <canvas ref={canvasRef} width={1920} height={1080} style={{ background: "black" }} />;
};

export default RadarCanvas;

