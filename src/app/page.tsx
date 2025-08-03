'use client';
import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';

export default function Home() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [modo, setModo] = useState('macd');
  const [periodo, setPeriodo] = useState(2);
  const [atrMin, setAtrMin] = useState(10);
  const [lucro, setLucro] = useState('Carregando dados...');
  const [invertido, setInvertido] = useState(false);

  const calcularEMA = (array, periodo) => {
    const k = 2 / (periodo + 1);
    const emaArray = [];
    let ema = array.slice(0, periodo).reduce((a, b) => a + b) / periodo;
    emaArray[periodo - 1] = ema;
    for (let i = periodo; i < array.length; i++) {
      ema = array[i] * k + ema * (1 - k);
      emaArray[i] = ema;
    }
    return emaArray;
  };

  const calcularSMA = (array, periodo) => {
    const sma = [];
    for (let i = periodo - 1; i < array.length; i++) {
      let soma = 0;
      for (let j = 0; j < periodo; j++) {
        soma += array[i - j];
      }
      sma[i] = soma / periodo;
    }
    return sma;
  };

  const calcularATR = (highs, lows, closes, periodo = 14) => {
    const trs = [0];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
    return calcularEMA(trs, periodo);
  };

  const calcularMACD = (closes) => {
    const ema12 = calcularEMA(closes, 12);
    const ema26 = calcularEMA(closes, 26);
    const macd = closes.map((_, i) =>
      ema12[i] !== undefined && ema26[i] !== undefined ? ema12[i] - ema26[i] : undefined
    );
    const linhaSinal = calcularEMA(macd.filter(Boolean), 9);
    const diff = macd.length - linhaSinal.length;
    const sinal = Array(diff).fill(undefined).concat(linhaSinal);
    return { macd, sinal };
  };

  const gerarSinais = (closes, sma, macd, sinal, atr) => {
    const sinais = [];
    for (let i = 1; i < closes.length; i++) {
      if (modo === 'macd') {
        if (macd[i - 1] === undefined || sinal[i - 1] === undefined || atr[i] < atrMin) {
          sinais[i] = null;
          continue;
        }
        const cruzou = macd[i - 1] < sinal[i - 1] && macd[i] > sinal[i]
          ? (invertido ? 'sell' : 'buy')
          : macd[i - 1] > sinal[i - 1] && macd[i] < sinal[i]
          ? (invertido ? 'buy' : 'sell')
          : null;
        sinais[i] = cruzou;
      } else {
        if (sma[i - 1] === undefined || sma[i] === undefined) {
          sinais[i] = null;
          continue;
        }
        if (closes[i - 1] < sma[i - 1] && closes[i] > sma[i]) {
          sinais[i] = invertido ? 'sell' : 'buy';
        } else if (closes[i - 1] > sma[i - 1] && closes[i] < sma[i]) {
          sinais[i] = invertido ? 'buy' : 'sell';
        } else {
          sinais[i] = null;
        }
      }
    }
    return sinais;
  };

  const calcularLucro = (sinais, closes, labels) => {
    let lucro = 0;
    let precoCompra = null;
    let texto = '';
    let operacao = 0;
    for (let i = 0; i < sinais.length; i++) {
      if (sinais[i] === 'buy' && precoCompra === null) {
        precoCompra = closes[i];
      } else if (sinais[i] === 'sell' && precoCompra !== null) {
        operacao++;
        const lucroOperacao = (closes[i] - precoCompra) / precoCompra;
        texto += `Operação ${operacao}: Lucro: ${(lucroOperacao * 100).toFixed(2)}%\n`;
        lucro += lucroOperacao;
        precoCompra = null;
      }
    }
    texto += `\nLucro Total Simulado: ${(lucro * 100).toFixed(2)}%`;
    setLucro(texto);
  };

  const desenharGrafico = (labels, closes, sma, sinais) => {
    if (chartRef.current) chartRef.current.destroy();

    const sinaisPoints = sinais.map((s, i) => s && {
      x: i,
      y: closes[i],
      color: s === 'buy' ? 'green' : 'red',
      shape: s === 'buy' ? 'triangle' : 'rect'
    }).filter(Boolean);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Preço BTC/USDT',
            data: closes,
            borderColor: '#00bcd4',
            tension: 0.3,
          },
          {
            label: `Média Móvel (${periodo})`,
            data: sma,
            borderColor: '#ffaa00',
            tension: 0.3,
          },
          ...sinaisPoints.map(p => ({
            label: p.shape === 'triangle' ? 'Compra' : 'Venda',
            data: [{ x: labels[p.x], y: p.y }],
            pointStyle: p.shape,
            borderColor: p.color,
            backgroundColor: p.color,
            pointRadius: 7,
            type: 'line',
            showLine: false
          }))
        ]
      },
      options: {
        plugins: {
          legend: { labels: { color: 'white' } }
        },
        scales: {
          x: { ticks: { color: 'white' }, grid: { color: '#333' } },
          y: { ticks: { color: 'white' }, grid: { color: '#333' } }
        }
      }
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=365');
      const data = await res.json();
      const labels = data.map(d => new Date(d[0]).toLocaleDateString('pt-BR'));
      const closes = data.map(d => parseFloat(d[4]));
      const highs = data.map(d => parseFloat(d[2]));
      const lows = data.map(d => parseFloat(d[3]));

      const sma = calcularSMA(closes, periodo);
      const atr = calcularATR(highs, lows, closes);
      const { macd, sinal } = calcularMACD(closes);
      const sinais = gerarSinais(closes, sma, macd, sinal, atr);

      desenharGrafico(labels, closes, sma, sinais);
      calcularLucro(sinais, closes, labels);
    };

    fetchData();
  }, [periodo, atrMin, modo, invertido]);

  return (
    <main style={{ background: '#121212', color: 'white', padding: 20 }}>
      <h1>Gráfico BTC com Análise {modo === 'macd' ? 'MACD' : 'Média Móvel'}</h1>
      <div style={{ marginBottom: 10 }}>
        <label>Período: </label>
        <input type="number" value={periodo} onChange={e => setPeriodo(+e.target.value)} />
        <label style={{ marginLeft: 10 }}>ATR Mínimo: </label>
        <input type="number" value={atrMin} step="0.1" onChange={e => setAtrMin(+e.target.value)} />
        <button onClick={() => setInvertido(!invertido)}>Inverter Sinais</button>
        <button onClick={() => setModo(m => (m === 'macd' ? 'mmPreco' : 'macd'))}>
          Modo: {modo === 'macd' ? 'MACD' : 'Média Móvel'}
        </button>
      </div>
      <canvas ref={canvasRef} width={1200} height={500}></canvas>
      <pre style={{ textAlign: 'left', marginTop: 20, whiteSpace: 'pre-wrap' }}>{lucro}</pre>
    </main>
  );
}
