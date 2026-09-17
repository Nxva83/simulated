import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root
    width: 1024; height: 640; visible: true
    title: "EPIKODI bench (Qt)"
    color: "#111111"

    property var entries: bridge.listDir("")

    header: Rectangle {
        height: 56; color: "#1c1c1c"
        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: "#333" }
        RowLayout {
            anchors.fill: parent; anchors.leftMargin: 24; anchors.rightMargin: 24; spacing: 16
            Label { text: "EPIKODI"; font.pixelSize: 20; font.bold: true; color: "#eee" }
            Label { text: "Qt / QML"; font.pixelSize: 13; color: "#99ccff" }
            Label { text: root.entries.length + " entrées"; font.pixelSize: 13; color: "#eee" }
            Item { Layout.fillWidth: true }
        }
    }

    GridView {
        anchors.fill: parent; anchors.margins: 16
        cellWidth: 232; cellHeight: 44
        model: root.entries
        delegate: Rectangle {
            width: 224; height: 36; radius: 6; color: "#1c1c1c"
            border.color: modelData.isDir ? "#3399ff" : "#333333"
            Label {
                anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12
                verticalAlignment: Text.AlignVCenter
                text: modelData.name; color: "#eee"; font.pixelSize: 13; elide: Text.ElideRight
            }
        }
    }
}
