# ⚔️ Medieval Arena P2P

A free, peer-to-peer multiplayer battle game set in a medieval fantasy world. Built with HTML5 Canvas and WebRTC (PeerJS) for direct browser-to-browser connections - no server required!

🎮 **[Play Now](https://YOUR_USERNAME.github.io/medieval-arena-p2p)**

## Features

- 🏰 **Medieval Theme**: Knights, swords, and arena combat
- 🌐 **P2P Multiplayer**: Direct connections between players using WebRTC
- 🎨 **Stylish Graphics**: Medieval-inspired UI with canvas-based rendering
- 💬 **Real-time Chat**: Communicate with other players
- ⚔️ **Combat System**: Melee attacks with cooldowns and damage
- 💚 **Health System**: Health bars, damage, and respawning
- 🎯 **Easy Lobby System**: Create or join games with simple room codes
- 👥 **2-4 Players**: Support for small group battles

## How to Play

### Hosting a Game
1. Click **"Create Game"** on the main menu
2. Share the generated room code with friends
3. Wait for players to join
4. Click **"Start Game"** when ready

### Joining a Game
1. Enter the room code provided by the host
2. Click **"Join Game"**
3. Wait for the host to start the game

### Controls

| Key | Action |
|-----|--------|
| **WASD** or **Arrow Keys** | Move your character |
| **SPACE** | Attack (with cooldown) |
| **Enter** | Open chat input |

### Gameplay
- Move around the arena using WASD or arrow keys
- Press SPACE to attack enemies within range
- Avoid getting hit - you have limited health!
- If you die, you'll respawn after 3 seconds
- Use chat to coordinate with teammates

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript with HTML5 Canvas
- **Networking**: PeerJS library for WebRTC P2P connections
- **Hosting**: Static files on GitHub Pages
- **No Backend**: Direct browser-to-browser communication

### How P2P Works
1. PeerJS connects to a public PeerServer for peer discovery
2. ICE servers (STUN) help establish direct WebRTC connections
3. Once connected, data flows directly between browsers
4. The host coordinates game state and synchronizes players

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari (13+)
- ❌ Internet Explorer

**Note**: WebRTC requires a secure context (HTTPS) or localhost for development.

## Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/medieval-arena-p2p.git
cd medieval-arena-p2p

# Serve locally (Python 3)
python -m http.server 8000

# Or with Node.js
npx http-server

# Open in browser
open http://localhost:8000
```

## Deployment

This game is designed to run on GitHub Pages:

1. Fork this repository
2. Go to Settings -> Pages
3. Select "Deploy from a branch" and choose "main"
4. Your game will be available at `https://YOUR_USERNAME.github.io/medieval-arena-p2p`

## Assets

Game assets are from [Superpowers Asset Packs](https://github.com/sparklinlabs/superpowers-asset-packs) by Sparklin Labs, licensed under CC0 (Public Domain).

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Credits

- Game code: Built with ❤️ using PeerJS and HTML5 Canvas
- Assets: CC0 Medieval Fantasy asset pack by Sparklin Labs
- Fonts: System fonts with medieval styling

## Contributing

Contributions welcome! Feel free to submit issues or pull requests.

## Known Limitations

- Requires internet connection for initial PeerJS connection
- Some networks may block WebRTC (corporate firewalls, etc.)
- Max 4 players recommended for best performance
- No persistence - game state is lost on refresh