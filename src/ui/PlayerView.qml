import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import QtMultimedia
import Epikodi.Media
import "components"

// Vue « Lecteur » : surface video + barre de controles + gestion des erreurs.
// Toute la logique passe par Epikodi.Media.Player ; ce fichier ne fait que de l'affichage.
FocusScope {
    id: view

    property alias player: player
    readonly property bool hasMedia: player.status !== Player.NoMedia && player.status !== Player.Error

    function open(url) {
        player.stop()
        player.source = url
        player.play()
        view.forceActiveFocus()
    }

    function formatTime(ms) {
        const total = Math.max(0, Math.floor(ms / 1000))
        const h = Math.floor(total / 3600)
        const m = Math.floor((total % 3600) / 60)
        const s = total % 60
        const mm = (h > 0 && m < 10 ? "0" : "") + m
        const ss = (s < 10 ? "0" : "") + s
        return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss
    }

    Player {
        id: player
        videoSink: videoOutput.videoSink
        volume: 0.8
    }

    FileDialog {
        id: fileDialog
        title: "Ouvrir un média"
        nameFilters: MediaFormats.nameFilters
        onAccepted: view.open(selectedFile)
    }

    // Raccourcis clavier
    Keys.onSpacePressed: player.togglePlayPause()
    Keys.onLeftPressed: player.seekBy(-10000)
    Keys.onRightPressed: player.seekBy(10000)
    Keys.onUpPressed: player.volume = Math.min(1, player.volume + 0.05)
    Keys.onDownPressed: player.volume = Math.max(0, player.volume - 0.05)
    Keys.onPressed: (event) => {
        if (event.key === Qt.Key_M) { player.muted = !player.muted; event.accepted = true }
        else if (event.key === Qt.Key_O && event.modifiers & Qt.ControlModifier) { fileDialog.open(); event.accepted = true }
    }

    Rectangle {
        anchors.fill: parent
        color: "#000000"

        VideoOutput {
            id: videoOutput
            anchors.fill: parent
            fillMode: VideoOutput.PreserveAspectFit
            visible: player.hasVideo
        }

        // Etat vide / audio seul / erreur
        ColumnLayout {
            anchors.centerIn: parent
            spacing: 12
            visible: !player.hasVideo

            Label {
                Layout.alignment: Qt.AlignHCenter
                font.pixelSize: 56
                color: player.status === Player.Error ? "#ff6b6b" : "#3d8bfd"
                text: player.status === Player.Error ? "⚠"
                    : player.status === Player.Ended ? "↻"
                    : player.hasAudio ? "♫" : "▶"
            }
            Label {
                Layout.alignment: Qt.AlignHCenter
                Layout.maximumWidth: view.width * 0.7
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                color: player.status === Player.Error ? "#ff6b6b" : "#ffffff"
                font.pixelSize: 18
                text: player.status === Player.Error ? player.errorMessage
                    : player.status === Player.Ended ? "Lecture terminée — Espace pour relire"
                    : player.hasAudio ? player.source.toString().split("/").pop()
                    : "Aucun média chargé"
            }
            Button {
                Layout.alignment: Qt.AlignHCenter
                text: "Ouvrir un fichier…  (Ctrl+O)"
                onClicked: fileDialog.open()
            }
        }

        MouseArea {
            anchors.fill: parent
            anchors.bottomMargin: controls.height
            onClicked: { view.forceActiveFocus(); if (view.hasMedia) player.togglePlayPause() }
            onDoubleClicked: fileDialog.open()
        }

        // Barre de controles
        Rectangle {
            id: controls
            anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
            height: 84
            color: "#cc17171d"

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 4

                Slider {
                    id: seekBar
                    Layout.fillWidth: true
                    from: 0
                    to: Math.max(1, player.duration)
                    enabled: player.seekable
                    // Pendant le glisser, le curseur suit la souris ; sinon il suit la lecture.
                    value: pressed ? value : player.position
                    onPressedChanged: if (!pressed) player.seek(value)
                }

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 12

                    ToolButton {
                        text: player.playing ? "⏸" : "▶"
                        font.pixelSize: 18
                        enabled: view.hasMedia
                        onClicked: player.togglePlayPause()
                    }
                    ToolButton { text: "⏹"; enabled: view.hasMedia; onClicked: player.stop() }

                    Label {
                        color: "#dddde6"
                        font.pixelSize: 13
                        text: view.formatTime(seekBar.pressed ? seekBar.value : player.position)
                              + " / " + view.formatTime(player.duration)
                    }

                    Item { Layout.fillWidth: true }

                    Label {
                        color: "#8a8a99"
                        font.pixelSize: 12
                        elide: Text.ElideMiddle
                        Layout.maximumWidth: 320
                        text: view.hasMedia ? player.source.toString().split("/").pop() : ""
                    }

                    ToolButton {
                        text: player.muted || player.volume === 0 ? "🔇" : "🔊"
                        onClicked: player.muted = !player.muted
                    }
                    Slider {
                        Layout.preferredWidth: 110
                        from: 0; to: 1
                        value: player.volume
                        onMoved: player.volume = value
                    }
                    ToolButton { text: "📂"; onClicked: fileDialog.open() }
                }
            }
        }
    }
}
