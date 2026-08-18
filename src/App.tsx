import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Box, PerspectiveCamera, Text, Environment } from '@react-three/drei';
import { XR, createXRStore } from '@react-three/xr'; // XR v6 の主要API
import { 
  ThemeProvider, createTheme, Box as MUIBox, 
  Typography, Button, Drawer, TextField, Stack 
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';

// --- XR ストアの作成 (v6系での変更点) ---
const store = createXRStore({
  emulatedHand: true, // シミュレーター用
});

// --- テーマ設定 ---
const theme = createTheme({
  palette: {
    primary: { main: '#5d4037' },
    secondary: { main: '#8d6e63' },
  },
});

// --- コンポーネント: 本棚のアイテム ---
const ShelfItem = ({ position, color, label }) => (
  <group position={position}>
    <Box args={[0.2, 0.3, 0.05]}>
      <meshStandardMaterial color={color} />
    </Box>
    <Text
      position={[0, 0, 0.03]}
      fontSize={0.05}
      color="white"
      anchorX="center"
      anchorY="middle"
    >
      {label}
    </Text>
  </group>
);

// --- コンポーネント: 店舗空間 ---
const StoreScene = ({ leftShelfItems, rightShelfItems }) => {
  return (
    <>
      <Sky sunPosition={[100, 20, 100]} />
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Environment preset="city" />

      {/* 床 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>

      {/* 前方の壁 */}
      <Box args={[4, 3, 0.1]} position={[0, 1.5, -2]}>
        <meshStandardMaterial color="#e0e0e0" />
      </Box>

      {/* 左の本棚 */}
      <group position={[-1.5, 0, -0.5]} rotation={[0, Math.PI / 2, 0]}>
        <Box args={[2, 2.5, 0.3]} position={[0, 1.25, 0]}>
          <meshStandardMaterial color="#5d4037" />
        </Box>
        {leftShelfItems.map((item, i) => (
          <ShelfItem key={i} position={[(i * 0.3) - 0.5, 1.5, 0.2]} color="teal" label={item.name} />
        ))}
      </group>

      {/* 右の本棚 */}
      <group position={[1.5, 0, -0.5]} rotation={[0, -Math.PI / 2, 0]}>
        <Box args={[2, 2.5, 0.3]} position={[0, 1.25, 0]}>
          <meshStandardMaterial color="#5d4037" />
        </Box>
        {rightShelfItems.map((item, i) => (
          <ShelfItem key={i} position={[(i * -0.3) + 0.5, 1.0, 0.2]} color="maroon" label={item.name} />
        ))}
      </group>

      <OrbitControls makeDefault />
    </>
  );
};

// --- メインコンポーネント ---
export default function App() {
  const [editMode, setEditMode] = useState(false);
  const [leftShelfName, setLeftShelfName] = useState("技術書棚");
  const [rightShelfName, setRightShelfName] = useState("雑貨棚");

  const [leftItems] = useState([{ name: 'React' }, { name: 'Fiber' }, { name: 'XR v6' }]);
  const [rightItems] = useState([{ name: 'Coffee' }, { name: 'Lamp' }]);

  return (
    <ThemeProvider theme={theme}>
      <div style={{ width: '100vw', height: '100vh', background: '#111', position: 'relative' }}>
        
        {/* キャンバス */}
        <Canvas shadows camera={{ position: [0, 1.6, 3], fov: 50 }}>
          {/* XR v6 では <XR> でラップし、storeを渡す */}
          <XR store={store}>
            <Suspense fallback={null}>
              <StoreScene leftShelfItems={leftItems} rightShelfItems={rightItems} />
            </Suspense>
          </XR>
        </Canvas>

        {/* --- UIレイヤー --- */}
        
        {/* 左上: 編集・VR起動ボタン */}
        <MUIBox sx={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: 2, zIndex: 1000 }}>
          <Button 
            variant="contained" 
            startIcon={editMode ? <VisibilityIcon /> : <EditIcon />}
            onClick={() => setEditMode(!editMode)}
            sx={{ borderRadius: 8, px: 3, bgcolor: 'primary.main' }}
          >
            {editMode ? "プレビュー" : "編集"}
          </Button>

          <Button 
            variant="contained" 
            color="secondary"
            startIcon={<SportsEsportsIcon />}
            onClick={() => store.enterVR()} // v6のVR起動方法
            sx={{ borderRadius: 8, px: 3 }}
          >
            VRモード起動
          </Button>
        </MUIBox>

        {/* 右側: 編集用ドロワー */}
        <Drawer
          anchor="right"
          open={editMode}
          onClose={() => setEditMode(false)}
          variant="persistent"
          PaperProps={{ sx: { width: 320, p: 3, borderLeft: 'none', boxShadow: -5 } }}
        >
          <Typography variant="h6" fontWeight="bold" gutterBottom>Shop Editor</Typography>
          <Typography variant="body2" color="text.secondary" mb={4}>棚の内容を編集できます</Typography>
          
          <Stack spacing={4}>
            <MUIBox>
              <TextField 
                fullWidth 
                label="左の棚（名称）" 
                variant="standard"
                value={leftShelfName} 
                onChange={(e) => setLeftShelfName(e.target.value)}
              />
            </MUIBox>

            <MUIBox>
              <TextField 
                fullWidth 
                label="右の棚（名称）" 
                variant="standard"
                value={rightShelfName} 
                onChange={(e) => setRightShelfName(e.target.value)}
              />
            </MUIBox>
            
            <Button variant="contained" size="large" onClick={() => setEditMode(false)}>
              変更を保存
            </Button>
          </Stack>
        </Drawer>

        {/* 下部メッセージ */}
        {!editMode && (
          <MUIBox sx={{ position: 'absolute', bottom: 30, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 }}>
              ドラッグで視点移動 / VRボタンで没入体験
            </Typography>
          </MUIBox>
        )}
      </div>
    </ThemeProvider>
  );
}