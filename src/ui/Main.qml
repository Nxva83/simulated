import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "components"

ApplicationWindow {
    id: root
    width: 1280
    height: 720
    minimumWidth: 960
    minimumHeight: 540
    visible: true
    title: "EPIKODI " + Qt.application.version
    color: "#101014"

    property string currentSection: "films"
    /// Fichier passe en ligne de commande (epikodi <fichier>) : ouvert directement dans le lecteur.
    property url initialFile

    Component.onCompleted: {
        if (initialFile.toString() !== "") {
            currentSection = "lecteur"
            playerView.open(initialFile)
        }
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // Barre laterale
        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: 220
            color: "#17171d"

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 4

                Label {
                    text: "EPIKODI"
                    color: "#ffffff"
                    font.pixelSize: 22
                    font.bold: true
                    Layout.bottomMargin: 24
                }

                Repeater {
                    model: [
                        { key: "films",    label: "Films" },
                        { key: "series",   label: "Séries" },
                        { key: "musique",  label: "Musique" },
                        { key: "podcasts", label: "Podcasts" },
                        { key: "fichiers", label: "Fichiers" },
                        { key: "lecteur",  label: "Lecteur" }
                    ]
                    delegate: SidebarItem {
                        required property var modelData
                        Layout.fillWidth: true
                        text: modelData.label
                        active: root.currentSection === modelData.key
                        onClicked: root.currentSection = modelData.key
                    }
                }

                Item { Layout.fillHeight: true }

                Label {
                    text: "v" + Qt.application.version
                    color: "#5c5c6a"
                    font.pixelSize: 12
                }
            }
        }

        // Zone principale
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.currentSection === "lecteur" ? 1 : 0

            // Sections de bibliotheque (a venir)
            Item {
                ColumnLayout {
                    anchors.centerIn: parent
                    spacing: 8

                    Label {
                        text: root.currentSection.charAt(0).toUpperCase() + root.currentSection.slice(1)
                        color: "#ffffff"
                        font.pixelSize: 28
                        Layout.alignment: Qt.AlignHCenter
                    }
                    Label {
                        text: "Bibliothèque vide — ajoutez une source pour commencer."
                        color: "#8a8a99"
                        font.pixelSize: 14
                        Layout.alignment: Qt.AlignHCenter
                    }
                }
            }

            // Le lecteur reste instancie quand on change de section : la lecture continue.
            PlayerView {
                id: playerView
                focus: true
            }
        }
    }
}
