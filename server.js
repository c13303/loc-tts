const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

// Initialiser l'application Express
const app = express();
const port = 6666;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Création du dossier audio s'il n'existe pas
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir);
}

// Chemin complet vers l'exécutable piper
const piperPath = '/home/charles/.local/bin/piper';

// Configuration des voix disponibles
const voices = {
    'en': {
        model: '/home/charles/.local/share/piper/en_US_amy/low/en_US-amy-low.onnx',
        description: 'English (US) - Amy'
    },
    'fr': {
        model: '/home/charles/.local/share/piper/fr_FR_tom2/low/fr_FR-tom2-low.onnx',
        description: 'Français - Tom'
    }
};

// Fonction pour appliquer des effets audio avec ffmpeg
const applyAudioEffects = (inputFile, outputFile, effects) => {
    return new Promise((resolve, reject) => {
        let command = ffmpeg(inputFile);

        // Appliquer les effets selon les paramètres
        if (effects.flanger) {
            command = command.audioFilters(`flanger=delay=${effects.flanger.delay || 5}:depth=${effects.flanger.depth || 2}`);
        }

        if (effects.phaser) {
            command = command.audioFilters(`aphaser=in_gain=${effects.phaser.inGain || 0.6}:out_gain=${effects.phaser.outGain || 0.7}`);
        }

        if (effects.delay) {
            command = command.audioFilters(`aecho=0.8:0.9:${effects.delay.time || 1000}:${effects.delay.decay || 0.5}`);
        }

        if (effects.reverb) {
            // Simulation de réverbération avec aecho
            command = command.audioFilters(`aecho=0.8:0.9:${effects.reverb.roomSize || 100}:${effects.reverb.decay || 0.6}`);
        }

        command
            .audioCodec('pcm_s16le')
            .format('wav')
            .on('error', (err) => {
                reject(`Error applying effects: ${err.message}`);
            })
            .on('end', () => {
                resolve(outputFile);
            })
            .save(outputFile);
    });
};

app.post('/synthesize', (req, res) => {
    const { text, voice = 'en', effects = {} } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Le texte est requis' });
    }

    // Vérifier si la voix demandée existe
    if (!voices[voice]) {
        return res.status(400).json({
            error: `Voix "${voice}" non disponible. Voix disponibles: ${Object.keys(voices).join(', ')}`
        });
    }

    // Création d'un hash pour le fichier audio de base
    const baseHash = crypto.createHash('md5').update(text + voice).digest('hex');
    const baseAudioFile = path.join(audioDir, `${baseHash}.wav`);

    // Hash pour la version avec effets
    const effectsString = JSON.stringify(effects);
    const effectsHash = crypto.createHash('md5').update(baseHash + effectsString).digest('hex');
    const effectsAudioFile = path.join(audioDir, `${effectsHash}.wav`);

    // Si le fichier avec effets existe déjà, on le renvoie directement
    if (fs.existsSync(effectsAudioFile)) {
        return res.json({
            success: true,
            audioUrl: `/audio/${effectsHash}.wav`,
            cached: true
        });
    }

    // Vérifier si le fichier de base existe déjà
    const synthesizeBase = !fs.existsSync(baseAudioFile);

    // Fonction pour appliquer les effets après synthèse
    const processWithEffects = async () => {
        try {
            // Vérifier si des effets sont demandés
            const hasEffects = Object.keys(effects).some(key => effects[key]);

            if (hasEffects) {
                // Appliquer les effets et retourner le chemin du fichier modifié
                await applyAudioEffects(baseAudioFile, effectsAudioFile, effects);
                return res.json({
                    success: true,
                    audioUrl: `/audio/${effectsHash}.wav`,
                    cached: false,
                    withEffects: true
                });
            } else {
                // Pas d'effets, utiliser le fichier de base
                return res.json({
                    success: true,
                    audioUrl: `/audio/${baseHash}.wav`,
                    cached: !synthesizeBase,
                    withEffects: false
                });
            }
        } catch (error) {
            console.error('Erreur lors de l\'application des effets:', error);
            return res.status(500).json({ error: `Erreur lors de l'application des effets: ${error}` });
        }
    };

    // Si le fichier de base existe déjà, appliquer directement les effets
    if (!synthesizeBase) {
        return processWithEffects();
    }

    // Récupérer le chemin du modèle
    const modelPath = voices[voice].model;

    // Vérifier si le modèle existe
    if (!fs.existsSync(modelPath)) {
        return res.status(500).json({ error: `Modèle ${modelPath} introuvable.` });
    }

    // Écrire le texte dans un fichier temporaire
    const tempTextFile = path.join(__dirname, `${baseHash}-input.txt`);
    fs.writeFileSync(tempTextFile, text, 'utf8');

    // Utiliser le chemin complet vers piper
    const command = `cat ${tempTextFile} | ${piperPath} --model ${modelPath} --output_file ${baseAudioFile}`;

    exec(command, async (error, stdout, stderr) => {
        // Nettoyer le fichier temporaire
        try {
            fs.unlinkSync(tempTextFile);
        } catch (e) {
            console.error('Erreur lors de la suppression du fichier temporaire:', e);
        }

        if (error) {
            console.error('Erreur Piper:', error);
            console.error('Stdout:', stdout);
            console.error('Stderr:', stderr);
            return res.status(500).json({ error: `Erreur lors de la synthèse vocale: ${stderr}` });
        }

        // Synthèse réussie, appliquer les effets
        return processWithEffects();
    });
});

// Route pour lister les voix disponibles
app.get('/voices', (req, res) => {
    const voiceList = {};

    for (const [key, value] of Object.entries(voices)) {
        voiceList[key] = {
            description: value.description,
            model: path.basename(value.model)
        };
    }

    res.json(voiceList);
});

// Route pour lister les effets disponibles
app.get('/effects', (req, res) => {
    res.json({
        flanger: {
            description: "Effet flanger (oscillation)",
            params: {
                delay: "Délai en ms (défaut: 5)",
                depth: "Profondeur (défaut: 2)"
            }
        },
        phaser: {
            description: "Effet phaser (balayage fréquentiel)",
            params: {
                inGain: "Gain d'entrée (défaut: 0.6)",
                outGain: "Gain de sortie (défaut: 0.7)"
            }
        },
        delay: {
            description: "Effet delay (écho)",
            params: {
                time: "Temps en ms (défaut: 1000)",
                decay: "Décroissance (défaut: 0.5)"
            }
        },
        reverb: {
            description: "Effet réverbération",
            params: {
                roomSize: "Taille de la pièce en ms (défaut: 100)",
                decay: "Décroissance (défaut: 0.6)"
            }
        }
    });
});

// Route de test pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
    res.send('Serveur TTS avec effets audio fonctionnel');
});

// Chemin du fichier JSON pour les presets
const presetsFile = path.join(__dirname, 'audio_presets.json');

// Charger les presets ou créer un fichier par défaut
let presets = {};
try {
    if (fs.existsSync(presetsFile)) {
        const data = fs.readFileSync(presetsFile, 'utf8');
        presets = JSON.parse(data);
    } else {
        // Presets par défaut
        presets = {
            "robot": {
                "delay": { "toggle": false },
                "filter": { "toggle": true, "freq": 1500, "q": 15 },
                "lfo": { "toggle": true, "freq": 4, "depth": 70, "target": "filter-freq", "wave": "square" },
                "distortion": { "toggle": true, "amount": 0.3 },
                "reverb": { "toggle": false }
            },
            "underwater": {
                "delay": { "toggle": true, "time": 0.2, "feedback": 0.6 },
                "filter": { "toggle": true, "freq": 800, "q": 8 },
                "lfo": { "toggle": true, "freq": 0.5, "depth": 80, "target": "filter-freq", "wave": "sine" },
                "distortion": { "toggle": false },
                "reverb": { "toggle": true, "decay": 3.0, "mix": 0.5 }
            },
            "echo": {
                "delay": { "toggle": true, "time": 0.5, "feedback": 0.7 },
                "filter": { "toggle": false },
                "lfo": { "toggle": false },
                "distortion": { "toggle": false },
                "reverb": { "toggle": false }
            },
            "cathedral": {
                "delay": { "toggle": true, "time": 0.3, "feedback": 0.3 },
                "filter": { "toggle": false },
                "lfo": { "toggle": false },
                "distortion": { "toggle": false },
                "reverb": { "toggle": true, "decay": 5.0, "mix": 0.7 }
            }
        };
        fs.writeFileSync(presetsFile, JSON.stringify(presets, null, 2), 'utf8');
    }
} catch (error) {
    console.error('Erreur lors du chargement des presets:', error);
    presets = {};
}

// Sauvegarder les presets dans le fichier
function savePresets() {
    try {
        fs.writeFileSync(presetsFile, JSON.stringify(presets, null, 2), 'utf8');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des presets:', error);
    }
}

// Route pour obtenir tous les presets
app.get('/presets', (req, res) => {
    res.json(presets);
});

// Route pour obtenir un preset spécifique
app.get('/presets/:name', (req, res) => {
    const presetName = req.params.name;
    if (presets[presetName]) {
        res.json(presets[presetName]);
    } else {
        res.status(404).json({ error: `Preset "${presetName}" introuvable` });
    }
});

// Route pour sauvegarder un nouveau preset
app.post('/presets/:name', (req, res) => {
    const presetName = req.params.name;
    const presetData = req.body;

    // Validation basique
    if (!presetData || typeof presetData !== 'object') {
        return res.status(400).json({ error: 'Données de preset invalides' });
    }

    // Sauvegarder le preset
    presets[presetName] = presetData;
    savePresets();

    res.json({ success: true, message: `Preset "${presetName}" sauvegardé` });
});

// Route pour supprimer un preset
app.delete('/presets/:name', (req, res) => {
    const presetName = req.params.name;

    // Vérifier si le preset existe
    if (!presets[presetName]) {
        return res.status(404).json({ error: `Preset "${presetName}" introuvable` });
    }

    // Ne pas supprimer les presets par défaut
    const defaultPresets = ['robot', 'underwater', 'echo', 'cathedral'];
    if (defaultPresets.includes(presetName)) {
        return res.status(403).json({ error: `Impossible de supprimer le preset par défaut "${presetName}"` });
    }

    // Supprimer le preset
    delete presets[presetName];
    savePresets();

    res.json({ success: true, message: `Preset "${presetName}" supprimé` });
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur TTS en écoute sur le port ${port}`);
    console.log(`Voix disponibles: ${Object.keys(voices).map(key => `${key} (${voices[key].description})`).join(', ')}`);
});