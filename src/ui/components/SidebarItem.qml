import QtQuick
import QtQuick.Controls

// Entree de la barre laterale : surlignee quand `active` est vrai.
AbstractButton {
    id: control
    property bool active: false

    implicitHeight: 40
    implicitWidth: 180

    background: Rectangle {
        radius: 8
        color: control.active ? "#2b2b36" : (control.hovered ? "#20202a" : "transparent")
        Rectangle {
            visible: control.active
            width: 3
            height: parent.height - 16
            radius: 1.5
            anchors.verticalCenter: parent.verticalCenter
            x: 4
            color: "#3d8bfd"
        }
    }

    contentItem: Label {
        text: control.text
        color: control.active ? "#ffffff" : "#b0b0bf"
        font.pixelSize: 15
        leftPadding: 16
        verticalAlignment: Text.AlignVCenter
    }
}
