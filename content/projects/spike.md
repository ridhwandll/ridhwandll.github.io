***A C++17 game engine, which can run on a toaster.***  

| Features                                     | Status                   |
| :---                                         |           :---:          |
| Console Logging                              | Done  |
| Internal Key and Mouse Codes                 | Done  |
| Input Polling                                | Done  |
| LayerStack and Layers                        | Done  |
| Event System and Events                      | Done  |
| 2D Renderer                                  | Done  |
| Entity Component System(ECS)                 | Done  |
| C# Scripting                                 | Done  |
| GUI Editor (Spike-Editor)                    | Done  |
| Scene Serialization and Deserialization      | Done  |
| Gizmos to control the Transform of the object| Done  |
| Built in developer console                   | Done  |
| Editor Camera                                | Done  |
| 2D Physics                                   | Done  |
| 3D model loading with albedo                 | Done  |
| Playmode and conept of scene runtime         | Done  |
| **Vault** system for caching assets          | Done  |
| And many more (not listed here)              | Done  |
| Material System                              | Done  |
| Asset Manager                                | Done  |
| DX11 Support                                 | Done  |
| OpenGL Support                               | Done  |
| Phong Lightning                              | Done  |

All the above features which are done are tested in **Release** mode

## Dependencies

- **[DearImGui](https://github.com/FahimFuad/imgui)** for Graphical User Interface
- **[mono](https://www.mono-project.com)** for C# scipting
- **[GLFW](https://github.com/FahimFuad/glfw)** for Windowing
- **[Glad](https://github.com/Dav1dde/glad)** OpenGL loader
- **[ImGuizmo](https://github.com/FahimFuad/ImGuizmo)** for Gizmo's
- **[stb_image](https://github.com/nothings/stb/blob/master/stb_image.h)** for image loading
- **[glm](https://github.com/g-truc/glm)** used as Math Library
- **[EnTT](https://github.com/skypjack/entt)** for Entity component system
- **[yaml-cpp](https://github.com/FahimFuad/yaml-cpp)** for scene serialization
- **[ASSIMP](https://github.com/FahimFuad/assimp)** for model loading
- **[box2D](https://github.com/FahimFuad/box2d)** for 2D Physics

<details>
  <summary>Toaster?</summary>
By toaster we mean old hardware. Spike can run smoothly even with a hardware from 2011. We have tested this engine on ATI RadeonHD 5570 (a GPU from 2011) with an Intel processor of 2nd generation! So Spike can run on any hardware which is from 2011 and onwards smoothly. Of Course having a better GPU and CPU will give you a perfomance boost!
</details>

> Spike was the engine I learned on, following the Game Engine Series by TheCherno. Surge is its reincarnation: same love for engines, much better decisions.
