+++ 
date = 2023-10-08T12:41:43+06:00
title = "Hot Reloading C++ Scripts(Part-01)"
description = ""
authors = [ "Ridhwan" ]
tags = [ "C++ Lines", "Scripting" ]
categories = [ "Programming" ]
+++

In previous post I discussed about the pointers in C++ which is pretty cringe and noob topic. So I will be like normal Ridhwan and jump from noob topic to a highly
advanced topic which is used in the game engines like Unreal Engine, C++ hot reloading!

Unlike 'C#', 'lua' C++ is not often used as a scripting language. Unreal Engine does that somehow & I have no idea how they do that. I rolled my own way of hot reloading C++ scripts
in my game engine Surge(Private Repository). It will come in several posts as it is hard to sum up in a single post. Today I will write about the C++ Reflection System which is a need for
C++ scripting.

## C++ Reflection System

Unlike other languages, C++ doesn't have built in reflection system in the language. You wondering what Reflection system is? Glad you asked, I have no idea. Wait I know a little bit maybe.
Reflection system in a language means to preserve data about the code even after the code is produced into an executable/compiled binary. I know you did not get what I wrote in previous line.
Don't worry, examples will clear stuff out.

```cpp
// File: Cake.h
#include <SurgeReflect/Reflection.hpp>

class Cake
{
public:
    unsigned int Weight = 100;
    int AddCake(int a, int b) { return a + b; }
private:
    float Price = 20;
};
```
In the above code the variables `Price`, `Weight` and function `AddCake` are the metadata of the code. They will be lost when the code is compiled. I want to preserve that. C++ has no
internal way of preserving these data aka reflection. So yeah, that's what reflection is.<br>

**In this post I won't write about how to make a reflection library with Run Time Type Information disabled.** Why?
- I already wrote a reflection library in the past for my engine Surge. It's public on github by the way. Here is the [link](https://github.com/SurgeTechnologies/SurgeReflect).
<br>

Once you have a reflection library set-up and working(You can use mine too, it's open source), you have to make a way to serialize and deserialize the reflection data. I used json for this in
my engine Surge. Ok now I ran out of my time to write these shit, seeya in part 2 which might come never. 😛

Thanks for reading, you are an IDIOT 💙

[![HitCount](https://hits.dwyl.com/FahimFuad/009y.svg?style=flat-square&show=unique)](http://hits.dwyl.com/FahimFuad/009y)

